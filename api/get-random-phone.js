// /api/get-random-phone.js
export default async function handler(req, res) {
  try {
    // ⚙️ EDITA TU AGENCY_ID AQUÍ
    const AGENCY_ID = 111;
    const API_URL = `https://api.foxyadminbot.info/api/v1/agency/${AGENCY_ID}/random-phone`;

    // Llamada a la API externa
    const response = await fetch(API_URL, {
      headers: { "Cache-Control": "no-store" },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();

    // Enviamos el JSON tal cual (o filtrado si querés)
    return res.status(200).json(data);
  } catch (err) {
    console.error("❌ Error al obtener número:", err);
    return res.status(500).json({ error: "No se pudo obtener número" });
  }
}
