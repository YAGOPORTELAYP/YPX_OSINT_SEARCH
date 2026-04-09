import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/vehicle-consultation", async (req, res) => {
    const { placa, renavam, chassi, type } = req.body;

    // Try PlacaCarro-API first for plates
    if (type === 'placa' || placa) {
      const searchPlaca = placa || (type === 'placa' ? req.body.query : null);
      if (searchPlaca) {
        try {
          const response = await axios.get(`https://wdapi2.com.br/consulta/${searchPlaca}/7000`);
          if (response.data.status === "1") {
            const data = response.data;
            return res.json({
              situacao_veiculo: data.situacao || "N/A",
              restricao_financeira: data.restricao || "N/A",
              marca_modelo: data.modelo || "N/A",
              cor: data.cor || "N/A",
              ano_fabricacao: data.ano || "N/A",
              ano_modelo: data.anoModelo || "N/A",
              chassi: data.chassi || "N/A",
              renavam: data.renavam || "N/A",
              placa: data.placa || "N/A",
              full_data: response.data
            });
          }
        } catch (error: any) {
          console.error("PlacaCarro-API fallback error:", error.message);
        }
      }
    }

    const token = process.env.INFOSIMPLES_TOKEN;
    const login_cpf = process.env.INFOSIMPLES_LOGIN_CPF;
    const login_senha = process.env.INFOSIMPLES_LOGIN_PASSWORD;

    if (!token || !login_cpf || !login_senha) {
      return res.status(500).json({ error: "InfoSimples credentials not configured." });
    }

    let endpoint = "https://api.infosimples.com/api/v2/consultas/ecrvsp-veiculos-bin";
    const payload: any = {
      token,
      login_cpf,
      login_senha
    };

    if (type === 'placa') {
      if (!placa) return res.status(400).json({ error: "Placa is required." });
      payload.placa = placa;
    } else if (type === 'renavam') {
      if (!renavam) return res.status(400).json({ error: "Renavam is required." });
      payload.renavam = renavam;
    } else if (type === 'chassi') {
      if (!chassi) return res.status(400).json({ error: "Chassi is required." });
      payload.chassi = chassi;
    } else {
      // Default to the previous behavior if no type is specified (placa + renavam)
      if (!placa || !renavam) return res.status(400).json({ error: "Placa and Renavam are required." });
      payload.placa = placa;
      payload.renavam = renavam;
    }

    try {
      const response = await axios.post(endpoint, payload);

      if (response.data.code === 200) {
        const data = response.data.data?.[0];
        const veiculo = data?.veiculo || {};
        
        res.json({
          situacao_veiculo: veiculo.situacao_veiculo || "N/A",
          restricao_financeira: veiculo.restricao_financeira || "N/A",
          marca_modelo: veiculo.marca_modelo || "N/A",
          cor: veiculo.cor || "N/A",
          ano_fabricacao: veiculo.ano_fabricacao || "N/A",
          ano_modelo: veiculo.ano_modelo || "N/A",
          chassi: veiculo.chassi || "N/A",
          renavam: veiculo.renavam || "N/A",
          placa: veiculo.placa || "N/A",
          full_data: response.data
        });
      } else {
        res.status(response.data.code || 400).json({ 
          error: response.data.errors?.[0] || "Error in vehicle consultation.",
          details: response.data
        });
      }
    } catch (error: any) {
      console.error("Vehicle consultation error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to connect to InfoSimples API.",
        details: error.response?.data || error.message
      });
    }
  });

  app.post("/api/cnpj-consultation", async (req, res) => {
    const { cnpj } = req.body;

    if (!cnpj) {
      return res.status(400).json({ error: "CNPJ is required." });
    }

    try {
      // Using Public CNPJA API (no key required, 5 req/min limit)
      const response = await axios.get(`https://open.cnpja.com/office/${cnpj.replace(/\D/g, '')}`);
      
      const data = response.data;
      
      // Normalize data for frontend
      const normalizedData = {
        ...data,
        name: data.company?.name || data.alias || "N/A",
        equity: data.company?.equity || 0,
        tax_regime: data.company?.simples?.optant ? "Simples Nacional" : "Regime Normal",
        status: {
          ...data.status,
          text: data.status?.text?.toUpperCase() || "UNKNOWN"
        }
      };

      res.json(normalizedData);
    } catch (error: any) {
      console.error("CNPJ consultation error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to connect to Public CNPJA API.",
        details: error.response?.data || error.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
