import React, { useState } from 'react';

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [geminiResponse, setGeminiResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleImageChange = (event) => {
    setSelectedImage(event.target.files[0]);
    setErrorMessage("")
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      setErrorMessage("No Image Uploaded");
      return;
    }

    const formData = new FormData();
    formData.append('images', selectedImage); // 'images' must match multer's upload.array("images")

    try {
      const response = await fetch('http://localhost:5000/process-prescription', { // Adjust the URL if needed
        method: 'POST',
        body: formData,
      });
      console.log("Response received from the server:", response) // Added log

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log("Data from response: ", data) // Added Log
      setGeminiResponse(data.response);
    } catch (error) {
      console.error('Error uploading image:', error);
      setErrorMessage("Failed to Upload Image");
    }
  };

  return (
    <div>
      <input type="file" onChange={handleImageChange} />
      <button onClick={handleUpload}>Upload</button>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      {geminiResponse && (
        <div>
          <h2>Gemini Response:</h2>
          <pre style={{whiteSpace: "pre-wrap"}}>{geminiResponse}</pre>
        </div>
      )}
    </div>
  );
}

export default App;