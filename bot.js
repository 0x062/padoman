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
const REGISTRAR_ABI = [
    "function available(string memory name) view returns(bool)",
    "function minCommitmentAge() view returns (uint256)",
    "function commit(bytes32 commitment) external",
    "function register(string memory name, address owner, uint duration, bytes32 secret) external payable"
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

/**
 * Fungsi utama untuk mendaftarkan domain
 * @param {string} fullDomainName - Nama domain lengkap yang ingin didaftarkan (contoh: "domainkeren.phrs")
 */
async function registerDomain(fullDomainName) {
    // Ekstrak label dari nama domain lengkap (misal: "domainkeren" dari "domainkeren.phrs")
    const label = fullDomainName.split('.')[0];
    if (!label) {
        console.error(`❌ Nama domain tidak valid: '${fullDomainName}'`);
        return;
    }

    // Normalisasi label sesuai standar ENS
    const normalizedLabel = ethers.ensNormalize(label);
    console.log(`✅ Memproses domain '${fullDomainName}' dengan label yang dinormalisasi: '${normalizedLabel}'`);
    console.log(`🚀 Memulai proses registrasi untuk: ${normalizedLabel}`);

    try {
        // --- LANGKAH 1: Cek Ketersediaan ---
        console.log(`[1/5] 🔍 Mengecek ketersediaan label '${normalizedLabel}'...`);
        const isAvailable = await contract.available(normalizedLabel);
        if (!isAvailable) {
            console.log(`❌ Label '${normalizedLabel}' sudah terdaftar.`);
            return;
        }
        console.log(`✅ Label tersedia!`);

        // --- LANGKAH 2: Membuat Komitmen (Secara Lokal) ---
        const ownerAddress = await wallet.getAddress();
        const secret = ethers.randomBytes(32); // Buat 'secret' acak yang aman
        
        console.log(`[2/5] 📝 Menghitung hash komitmen (secara lokal)...`);
        const commitment = ethers.solidityPackedKeccak256(
            ['string', 'address', 'bytes32'],
            [normalizedLabel, ownerAddress, secret]
        );
        console.log(`   - Commitment Hash: ${commitment}`);

        // --- LANGKAH 3: Mengirim Transaksi 'commit' ---
        console.log(`[3/5] ✉️ Mengirim transaksi 'commit' ke blockchain...`);
        const commitTx = await contract.commit(commitment);
        await commitTx.wait(); // Tunggu sampai transaksi dikonfirmasi
        console.log(`   - Transaksi Commit berhasil! Hash: ${commitTx.hash}`);

        // --- LANGKAH 4: Menunggu ---
        const waitTime = Number(await contract.minCommitmentAge()) + 10; // Ambil waktu tunggu dari contract + buffer 10 detik
        console.log(`[4/5] ⏳ Menunggu selama ${waitTime} detik...`);
        await sleep(waitTime * 1000);

        // --- LANGKAH 5: Mengirim Transaksi 'register' ---
        console.log(`[5/5] ✅ Mendaftarkan label secara final...`);
        const duration = 31536000; // 1 tahun dalam detik
        const registrationPrice = ethers.parseEther("0.001"); // Ganti dengan harga registrasi (jika perlu)

        const registerTx = await contract.register(normalizedLabel, ownerAddress, duration, secret, {
            value: registrationPrice 
        });
        await registerTx.wait();
        console.log(`\n🎉 SELAMAT! Domain '${normalizedLabel}.phrs' berhasil didaftarkan untukmu!`);
        console.log(`   - Alamat Owner: ${ownerAddress}`);
        console.log(`   - Transaksi Register Hash: ${registerTx.hash}`);

    } catch (error) {
        console.error("\n🔥 Terjadi kesalahan:", error);
    }
}

// =================================================================
// JALANKAN BOT
// Ganti "domainimpianku.phrs" dengan domain yang ingin kamu daftarkan
// =================================================================
registerDomain("domainimpianku.phrs");
