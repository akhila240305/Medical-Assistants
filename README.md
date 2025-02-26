# **Pharmacist's Assistant** 

This project provides an **Express.js-based backend** for a **React web application** that processes medical prescriptions using **Gemini AI**. It extracts **medicines, dosage, and frequency** from an uploaded prescription image, checks **medicine availability in a database**, and generates an **order summary** with pricing.  

---

## **🚀 Features**
✅ **OCR-Based Prescription Extraction** - Uses **Gemini AI** to extract medicine details from handwritten prescriptions.  
✅ **Medication Validation** - Checks if medicines are valid and correctly spelled.  
✅ **Database Lookup** - Verifies **medicine availability** in a pharmacy database.  
✅ **Automated Order Generation** - Lists medicines, quantities, and total cost.  
✅ **Handles Unavailable Medicines** - Displays unavailable medicines separately.  
✅ **Secure File Handling** - Uses **Multer** for image uploads.  

---

## **🛠️ Tech Stack**
- **Backend:** Node.js, Express.js  
- **AI Model:** Gemini AI API  
- **Database:** MySQL  
- **File Uploads:** Multer  
- **Environment Config:** dotenv  

---

## ** Flowchart**
graph TD
    A[User Uploads Prescription Image] -->|Image Sent via API| B[Express.js Backend]
    B -->|File Uploaded with Multer| C[Stored in 'uploads/' Directory]
    C -->|Image Sent to Gemini AI| D[Gemini AI Extracts Medicine Data]
    
    D -->|Response with Medicines Table| E[Parse Response]
    E -->|Extract Medicines & Validate| F[Check Medicine Validity]
    F -->|If Medicine is Valid| G[Check Database for Availability]
    F -->|If Invalid| H[Mark as 'Invalid' and Skip]

    G -->|If Available| I[Add to Order List]
    G -->|If Unavailable| J[Add to Unavailable List]

    I -->|Fetch Medicine Price| K[Calculate Order Total]
    K -->|Generate Order Summary| L[Prepare Final Response]
    
    L -->|Send JSON Response to Frontend| M[React Frontend Displays Order]

    J -->|Append to 'Unavailable Medicines' List| L
