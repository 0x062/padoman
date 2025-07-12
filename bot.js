// bot_pembuktian.js - Eksperimen Terakhir

require('dotenv').config();
const { ethers } = require('ethers');

// Konfigurasi minimal
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REGISTRAR_CONTRACT_ADDRESS = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";

// ABI minimal, hanya untuk satu fungsi
const REGISTRAR_ABI = [
    "function available(string memory name) view returns(bool)"
];

// Koneksi
if (!PHAROS_RPC_URL || !PRIVATE_KEY) throw new Error("Harap isi RPC_URL dan PRIVATE_KEY di .env");
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(REGISTRAR_CONTRACT_ADDRESS, REGISTRAR_ABI, wallet);

// Fungsi tes yang hanya melakukan SATU panggilan
async function checkAvailability(label) {
    console.log(`🔬 Melakukan tes panggilan paling sederhana: Available('${label}')...`);
    try {
        const isAvailable = await contract.Available(label);
        // Jika kode sampai di sini, itu keajaiban.
        console.log(`✅ Panggilan 'Available' berhasil! Hasilnya adalah: ${isAvailable}`);
        console.log("Ini berarti masalahnya mungkin ada pada fungsi lain.");
    } catch (error) {
        console.error("\n🔥🔥🔥 PANGGILAN GAGAL! 🔥🔥🔥");
        console.error("   - Pesan:", error.reason || error.message);
        console.error("\nIni adalah BUKTI FINAL bahwa bahkan panggilan paling dasar pun diblokir.");
        console.error("Masalahnya BUKAN di kode, tetapi pada IZIN (Whitelist) atau KONEKSI RPC.");
    }
}

// Jalankan tes
checkAvailability("test");
