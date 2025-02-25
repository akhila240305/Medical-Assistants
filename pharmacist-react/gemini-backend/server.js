import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import pool from "./database.js";
import medicationModel from "./models/medicationModel.js";
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Configure CORS to allow requests from http://localhost:5173
const corsOptions = {
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};
app.use(cors(corsOptions));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Function to upload files to Gemini
async function uploadToGemini(file) {
    const fileData = await fs.readFile(file.path, {
      encoding: "base64",
    });
    return {
      fileData: fileData,
      mimeType: file.mimetype,
    };
}

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Initialize model with instructions
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `
        You are a helpful pharmacist assistant. Your task is to process prescription images and generate an order summary.
        1.  **Image Analysis:** I will provide you with a prescription image. Extract all medicines, their dosages, and frequencies.
        2.  **Database Check:** Check if each medicine is in our pharmacy database.
        3.  **Table Generation:** Create a table with the following columns:
            *   Serial No
            *   Medicine Name
            *   Dosage
            *   Frequency
            *   Notes (will be 'In Stock', 'Out of Stock', or 'Not in Database' based on database check)
            *   Availability (will be 'Available', or 'Not Available')
        4.  **Order Generation:** Create an order list with the following format:
            *   **Order:**
                *   Medicine Name x Quantity = Total Price
                *   ...
            *   Total: $Total Price
        5. **Unavailable List**: Add a list after the order, that lists the medicines that were not in the order.
        6. **Output**: You must only output the table, the order, and the unavailable list. Nothing else.
        `,
});

// Generation settings
const generationConfig = {
    temperature: 0,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

// Handle file uploads and process prescription images
app.post("/process-prescription", upload.array("images"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No images uploaded." });
        }

        // Read files
        const files = await Promise.all(
            req.files.map(async (file) => {
              return await uploadToGemini(file);
            })
          );

        const chatSession = model.startChat({
            generationConfig,
            history: files.map((file) => ({
              role: "user",
              parts: [
                { inlineData: { data: file.fileData, mimeType: file.mimeType } },
              ],
            })),
        });

        const result = await chatSession.sendMessage("");
        let geminiResponse = result.response.text();

        const lines = geminiResponse.trim().split('\n');

        let order = [];
        const unavailableMedicines = [];

        // Function to format order
        const formatOrder = (order) => {
          let orderText = "Order:\n";
          let total = 0;
          for (const item of order) {
            orderText += `  ${item.name} x${item.quantity} = $${item.total}\n`;
            total += item.total
          }
          orderText += `Total: $${total.toFixed(2)}\n`;
          return orderText;
        };
        //Get the table
        const tableLines = [];
        let tableStarted = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("| Serial No") && line.includes("| Medicine")) {
            tableStarted = true;
          }
          if (tableStarted) {
            tableLines.push(line);
          }
          if(tableStarted && (line ==="" || i === lines.length - 1)){
            tableStarted = false;
          }
        }

        // Extracting data from table
        const medicines = tableLines.slice(2)
        const availableMedicines = [];

        for (let i = 0; i < medicines.length; i++) {
          const medicine = medicines[i];
          if(!medicine.includes("|---|---|---|---|---|---|")){
            const [serialNo, name, dosage, frequency, notes, validity] = medicine.split("|").slice(1, -1).map(item => item.trim());;
            if(validity ==="Valid"){
              availableMedicines.push(name)
            }
          }
        }
        for (const medicineName of availableMedicines){
           const isInStock = await medicationModel.checkMedicationAvailability(medicineName)
          if (isInStock){
            const medicineDetails = await medicationModel.getMedicationDetails(medicineName)
            order.push({
              name: medicineName,
              quantity: 1,
              price: medicineDetails.price,
              total: medicineDetails.price * 1
            });
          }else{
            unavailableMedicines.push(medicineName)
          }
        }

        //Format the response
        let response = ""
        response+= tableLines.join("\n") + "\n\n"
        response += formatOrder(order)

        if (unavailableMedicines.length > 0){
          response += "Medicines not available:\n"
          for (const medicineName of unavailableMedicines){
            response+= `-${medicineName}\n`
          }
        }

        res.json({ response: response });

    } catch (error) {
        console.error("Error processing prescription:", error);
        res.status(500).json({ error: "Failed to process prescription" });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
