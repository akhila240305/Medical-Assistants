import pool from "../database.js";

async function getAllMedications() {
    const [rows] = await pool.query("SELECT * FROM medications");
    return rows;
}

async function getMedicationByName(name) {
  const [rows] = await pool.query('SELECT * FROM medications WHERE name = ?', [name]);
  return rows.length > 0 ? rows[0] : null;
}

async function checkMedicationAvailability(name) {
    const medication = await getMedicationByName(name);
    return medication ? medication.no_of_available > 0 : false;
}

async function getMedicationNotes(name) {
  const medication = await getMedicationByName(name);
  return medication ? `In Stock` : `Not in Database`;
}

async function getMedicationStock(name) {
  const medication = await getMedicationByName(name);
  return medication ? medication.no_of_available > 0 ? "In Stock" : "Out of Stock" : `Not in Database`;
}
async function getMedicationPrice(name) {
  const medication = await getMedicationByName(name);
  return medication ? medication.price : 0.00;
}
async function getMedicationDetails(name){
  return await getMedicationByName(name);
}

export default { getAllMedications, getMedicationByName, checkMedicationAvailability, getMedicationNotes, getMedicationStock, getMedicationPrice, getMedicationDetails };
