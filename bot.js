// bot.js - Skrip Final menggunakan alur registrasi yang benar

// 1. Impor library yang dibutuhkan
require('dotenv').config();
const { ethers } = require('ethers');

// =================================================================
// KONFIGURASI
// =================================================================
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REGISTRAR_CONTRACT_ADDRESS = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175"; // Alamat Registrar

// ABI (Application Binary Interface) yang Diperbarui dan Disederhanakan
const REGISTRAR_ABI = [
    // Fungsi untuk mendapatkan harga
    "function rentPrice(string memory name, uint256 duration) view returns(uint256)",
    // Fungsi registrasi tingkat tinggi yang menangani semua langkah
    "function registerAndWrapETH2LD(string calldata name, address wrappedOwner, uint256 duration, address resolver, uint16 ownerControlledFuses) external payable"
];
// =================================================================

// Validasi dan Koneksi
if (!PHAROS_RPC_URL || !PRIVATE_KEY) {
    console.error("❌ Harap isi PHAROS_RPC_URL dan PRIVATE_KEY di file .env.");
    process.exit(1);
}
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(REGISTRAR_CONTRACT_ADDRESS, REGISTRAR_ABI, wallet);

/**
 * Fungsi utama untuk mendaftarkan domain menggunakan alur yang benar
 * @param {string} label - Hanya label domain yang ingin didaftarkan (contoh: "patnerbot")
 */
async function registerDomain(label) {
    console.log(`🚀 Memulai proses registrasi untuk: ${label}.phrs`);

    try {
        const ownerAddress = await wallet.getAddress();
        const duration = 31536000; // 1 tahun

        // Langkah 1: Dapatkan harga sewa dari kontrak
        console.log("[1/2] Mengecek harga registrasi...");
        const price = await contract.rentPrice(label, duration);
        console.log(`   - Harga untuk 1 tahun: ${ethers.formatEther(price)} PHRS`);

        // Langkah 2: Panggil fungsi registrasi tingkat tinggi
        // Kita asumsikan resolver dan fuses bisa menggunakan nilai default yang umum.
        // Alamat resolver seringkali sama dengan alamat registrar itu sendiri.
        // Fuses 0 berarti tidak ada batasan khusus (pengaturan default).
        const resolverAddress = REGISTRAR_CONTRACT_ADDRESS; 
        const fuses = 0;

        console.log("[2/2] Mengirim transaksi final 'registerAndWrapETH2LD'...");
        const tx = await contract.registerAndWrapETH2LD(
            label,
            ownerAddress,
            duration,
            resolverAddress,
            fuses,
            {
                value: price, // Mengirim jumlah PHRS yang tepat sesuai harga
            }
        );

        console.log("   - Transaksi terkirim! Menunggu konfirmasi...");
        await tx.wait();

        console.log("\n\n🎉🎉🎉 SELAMAT! PENDAFTARAN BERHASIL! 🎉🎉🎉");
        console.log(`Domain '${label}.phrs' telah berhasil didaftarkan.`);
        console.log(`   - Transaksi Hash: ${tx.hash}`);

    } catch (error) {
        console.error("\n🔥🔥🔥 TERJADI KESALAHAN 🔥🔥🔥");
        console.error("   - Pesan:", error.message);
    }
}

// Ganti nama domain di bawah ini dengan yang kamu inginkan (HANYA LABELNYA)
registerDomain("patnerbotjuara");
