import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import pool from "./database.js";
import medicationModel from "./models/medicationModel.js";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const corsOptions = {
  origin: "http://localhost:5173",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};
app.use(cors(corsOptions));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const upload = multer({ dest: "uploads/" });

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: `
      Extract the prescribed medicines from the given prescription and return only a table with these columns:
      | Serial No | Medicine | Dosage | Frequency | Notes | Valid/Invalid |
      Mark "Invalid" if the medicine name is incorrect or unknown. Return only the table in Markdown format.
  `,
});

const generationConfig = {
  temperature: 0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

app.post("/process-prescription", upload.array("images"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded." });
    }

    const files = await Promise.all(
      req.files.map((file) =>
        fs.readFile(file.path, { encoding: "base64" }).then((fileData) => ({
          fileData,
          mimeType: file.mimetype,
        }))
      )
    );

    const chatSession = model.startChat({
      generationConfig,
      history: files.map((file) => ({
        role: "user",
        parts: [{ inlineData: { data: file.fileData, mimeType: file.mimeType } }],
      })),
    });

    const result = await chatSession.sendMessage("");
    const geminiResponse = result.response.text().trim();
    console.log("Gemini Response:\n", geminiResponse);

    const lines = geminiResponse.split("\n");
    let validMedicines = [];

    for (const line of lines) {
      if (!line.includes("|---|") && line.includes("|")) {
        const columns = line.split("|").map((col) => col.trim());
        if (columns.length >= 6) {
          const [serialNo, name, dosage, frequency, notes, validity] = columns.slice(1, -1);
          if (validity && validity.toLowerCase() === "valid") {
            validMedicines.push({ name, dosage, frequency });
          }
        }
      }
    }

    console.log("Extracted Medicines:", validMedicines);

    const order = [];
    const unavailableMedicines = [];

    for (const med of validMedicines) {
      console.log(`Checking availability for: ${med.name}`);
      const isAvailable = await medicationModel.checkMedicationAvailability(med.name);
      console.log(`Is Available: ${isAvailable}`);

      if (isAvailable) {
        const medDetails = await medicationModel.getMedicationDetails(med.name);
        console.log(`Medicine Details:`, medDetails);

        order.push({
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          quantity: 1,
          price: medDetails.price,
          total: medDetails.price * 1,
        });
      } else {
        unavailableMedicines.push(med.name);
      }
    }

    const formatOrder = (order) => {
      if (order.length === 0) return "**No available medicines.**";
    
      let orderText = "**Generated Order:**\n\n";
      orderText += "| # | Medicine | Dosage | Frequency | Quantity | Price |\n";
      orderText += "|---|----------|--------|-----------|----------|-------|\n";
    
      let total = 0;
    
      order.forEach((item, index) => {
        orderText += `| ${index + 1} | ${item.name} | ${item.dosage} | ${item.frequency} | ${item.quantity} | $${item.total.toFixed(2)} |\n`;
        total += item.total;
      });
    
      orderText += `\n**Total Price: $${total.toFixed(2)}**\n`;
      return orderText;
    };
    

    let response = formatOrder(order);

    if (unavailableMedicines.length > 0) {
      response += "\n**Unavailable Medicines:**\n";
      unavailableMedicines.forEach((med) => (response += `- ${med}\n`));
    }

    res.json({ response });
  } catch (error) {
    console.error("Error processing prescription:", error);
    res.status(500).json({ error: "Failed to process prescription" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
