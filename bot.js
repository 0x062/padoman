// register.js

require('dotenv').config();
const { ethers } = require('ethers');

// =================================================================
// KONFIGURASI PHAROS TESTNET - GANTI DENGAN DATAMU!
// =================================================================
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL; // Isi di file .env
const PRIVATE_KEY = process.env.PRIVATE_KEY;      // Isi di file .env

// Alamat contract yang kamu temukan dari block explorer Pharos Testnet
const REGISTRAR_CONTRACT_ADDRESS = process.env.KONTRAK; 

// ABI yang lebih lengkap untuk alur Commit & Register
const REGISTRAR_ABI = [
    // Read functions
    "function available(string memory name) view returns(bool)",
    "function minCommitmentAge() view returns (uint256)",
    "function makeCommitment(string memory name, address owner, bytes32 secret) view returns (bytes32)",

    // Write functions
    "function commit(bytes32 commitment) external",
    "function register(string memory name, address owner, uint duration, bytes32 secret) external payable"
];
// =================================================================

// Cek konfigurasi
if (!PHAROS_RPC_URL || !PRIVATE_KEY || REGISTRAR_CONTRACT_ADDRESS === "0x...AlamatKontrakRegistrarPharos") {
    console.error("❌ Harap isi PHAROS_RPC_URL, PRIVATE_KEY, dan REGISTRAR_CONTRACT_ADDRESS di file .env dan di dalam kode ini.");
    process.exit(1);
}

// Menyiapkan Koneksi
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(REGISTRAR_CONTRACT_ADDRESS, REGISTRAR_ABI, wallet);

// Fungsi untuk membuat jeda/delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi Utama Bot
async function registerDomain(domainName) {
    console.log(`🚀 Memulai proses registrasi untuk: ${domainName}`);

    try {
        // --- LANGKAH 1: Cek Ketersediaan ---
        console.log(`[1/5] 🔍 Mengecek ketersediaan '${domainName}'...`);
        const isAvailable = await contract.available(domainName);
        if (!isAvailable) {
            console.log(`❌ Domain '${domainName}' sudah terdaftar.`);
            return;
        }
        console.log(`✅ Domain tersedia!`);

        // --- LANGKAH 2: Membuat Komitmen (Commitment) ---
        const ownerAddress = await wallet.getAddress();
        const secret = ethers.randomBytes(32); // Buat 'secret' acak untuk keamanan
        
        console.log(`[2/5] 📝 Membuat komitmen untuk owner ${ownerAddress}...`);
        const commitment = await contract.makeCommitment(domainName, ownerAddress, secret);
        console.log(`   - Commitment Hash: ${commitment}`);

        // --- LANGKAH 3: Mengirim Transaksi 'commit' ---
        console.log(`[3/5] ✉️ Mengirim transaksi 'commit' ke blockchain...`);
        const commitTx = await contract.commit(commitment);
        await commitTx.wait(); // Tunggu sampai transaksi dikonfirmasi
        console.log(`   - Transaksi Commit berhasil! Hash: ${commitTx.hash}`);

        // --- LANGKAH 4: Menunggu ---
        const waitTime = Number(await contract.minCommitmentAge()) + 10; // Ambil waktu tunggu dari contract + buffer 10 detik
        console.log(`[4/5] ⏳ Menunggu selama ${waitTime} detik sesuai aturan smart contract...`);
        await sleep(waitTime * 1000);

        // --- LANGKAH 5: Mengirim Transaksi 'register' ---
        console.log(`[5/5] ✅ Mendaftarkan domain secara final...`);
        const duration = 31536000; // 1 tahun dalam detik
        const registrationPrice = ethers.parseEther("0.001"); // Ganti dengan harga registrasi di Pharos (jika ada)

        const registerTx = await contract.register(domainName, ownerAddress, duration, secret, {
            value: registrationPrice 
        });
        await registerTx.wait();
        console.log(`\n🎉 SELAMAT! Domain '${domainName}' berhasil didaftarkan untukmu!`);
        console.log(`   - Transaksi Register Hash: ${registerTx.hash}`);

    } catch (error) {
        console.error("\n🔥 Terjadi kesalahan:", error.message);
    }
}

// Jalankan bot! Ganti 'domainkerenku' dengan nama yang kamu inginkan.
registerDomain("domainkerenku");
