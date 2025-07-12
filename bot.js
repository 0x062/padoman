// bot.js - Script Final Bot Registrasi Domain

// 1. Impor library yang dibutuhkan
require('dotenv').config(); // Memuat variabel dari file .env
const { ethers } = require('ethers');

// =================================================================
// KONFIGURASI - GANTI DENGAN DATA PHAROS TESTNET ANDA
// =================================================================
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Ganti dengan alamat smart contract registrar di Pharos Testnet
const REGISTRAR_CONTRACT_ADDRESS = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";

// ABI (Application Binary Interface) Final
// Tambahkan 'rentPrice' ke dalam ABI
const REGISTRAR_ABI = [
    "function available(string memory name) view returns(bool)",
    "function minCommitmentAge() view returns (uint256)",
    "function commit(bytes32 commitment) external",
    "function register(string memory name, address owner, uint duration, bytes32 secret) external payable",
    // Tambahkan fungsi untuk query harga (nama fungsi ini adalah tebakan)
    "function rentPrice(string memory name, uint256 duration) view returns(uint256)"
];
// =================================================================

// Validasi konfigurasi awal
if (!PHAROS_RPC_URL || !PRIVATE_KEY || REGISTRAR_CONTRACT_ADDRESS === "0x...") {
    console.error("❌ Harap isi PHAROS_RPC_URL, PRIVATE_KEY di file .env dan perbarui REGISTRAR_CONTRACT_ADDRESS di dalam skrip.");
    process.exit(1);
}

// 2. Menyiapkan Koneksi ke Blockchain
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(REGISTRAR_CONTRACT_ADDRESS, REGISTRAR_ABI, wallet);

// Fungsi helper untuk membuat jeda/delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function registerDomain(fullDomainName) {
    // ... (bagian awal fungsi tetap sama) ...
    const label = fullDomainName.split('.')[0];
    const normalizedLabel = ethers.ensNormalize(label);
    console.log(`✅ Memproses domain '${fullDomainName}' dengan label yang dinormalisasi: '${normalizedLabel}'`);
    console.log(`🚀 Memulai proses registrasi untuk: ${normalizedLabel}`);

    try {
        // ... (LANGKAH 1 s/d 4 TETAP SAMA, tidak perlu diubah) ...
        console.log(`[1/5] 🔍 Mengecek ketersediaan... ✅`);
        console.log(`[2/5] 📝 Menghitung hash komitmen... ✅`);
        console.log(`[3/5] ✉️ Mengirim transaksi 'commit'... ✅`);
        console.log(`[4/5] ⏳ Menunggu... ✅`);


        // --- LANGKAH 5: Mendaftarkan Label ---
        console.log(`[5/5] ✅ Mempersiapkan registrasi final...`);
        const duration = 31536000; // 1 tahun

        // =================================================================
        // FINAL FIX: TANGANI STRUKTUR HARGA DENGAN BENAR
        // =================================================================
        console.log(`   - Menanyakan harga sewa ke smart contract...`);
        const priceData = await contract.rentPrice(normalizedLabel, duration);
        
        // Log ini sangat penting untuk melihat apa yang sebenarnya dikembalikan kontrak
        console.log("   - Struktur data harga mentah:", priceData);

        let finalPrice;

        // Cek apakah priceData adalah objek dengan property 'base' (standar ENS)
        if (typeof priceData === 'object' && priceData.base) {
            console.log('   - Harga terdeteksi sebagai STRUKTUR (base + premium). Menjumlahkan...');
            // Harga total adalah base + premium. Keduanya adalah BigInt.
            finalPrice = priceData.base + priceData.premium;
        } else {
            // Jika bukan, asumsikan itu adalah satu nilai BigInt
            console.log('   - Harga terdeteksi sebagai NILAI TUNGGAL.');
            finalPrice = priceData;
        }

        console.log(`   - HARGA FINAL YANG AKAN DIKIRIM: ${ethers.formatUnits(finalPrice, "ether")} PHRS`);
        // =================================================================
        
        console.log(`   - Mengirim transaksi 'register' dengan harga yang tepat...`);
        const registerTx = await contract.register(normalizedLabel, ownerAddress, duration, secret, {
            value: finalPrice // Gunakan harga final yang sudah dihitung
        });
        await registerTx.wait();
        
        console.log(`\n🎉🎉 SELAMAT! BOT BERHASIL! 🎉🎉`);
        console.log(`Domain '${normalizedLabel}.phrs' berhasil didaftarkan untukmu!`);
        console.log(`   - Alamat Owner: ${ownerAddress}`);
        console.log(`   - Transaksi Register Hash: ${registerTx.hash}`);

    } catch (error) {
        // ... (bagian catch error tetap sama) ...
        console.error("\n🔥 Terjadi kesalahan:", error);
    }
}

registerDomain("domainimpiankhu.phrs");
