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
    "function Register(string memory name, address owner, uint duration, bytes32 secret) external payable",
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
    const label = fullDomainName.split('.')[0];
    if (!label) {
        console.error(`❌ Nama domain tidak valid: '${fullDomainName}'`);
        return;
    }

    const normalizedLabel = ethers.ensNormalize(label);
    console.log(`✅ Memproses domain '${fullDomainName}' dengan label yang dinormalisasi: '${normalizedLabel}'`);
    console.log(`🚀 Memulai proses registrasi untuk: ${normalizedLabel}`);

    try {
        // =================================================================
        // PERBAIKAN: Deklarasikan ownerAddress di sini agar bisa diakses semua langkah
        const ownerAddress = await wallet.getAddress();
        // =================================================================

        // --- LANGKAH 1: Cek Ketersediaan ---
        console.log(`[1/5] 🔍 Mengecek ketersediaan label '${normalizedLabel}'...`);
        const isAvailable = await contract.available(normalizedLabel);
        if (!isAvailable) {
            console.log(`❌ Label '${normalizedLabel}' sudah terdaftar.`);
            return;
        }
        console.log(`✅ Label tersedia!`);

        // --- LANGKAH 2: Membuat Komitmen (Secara Lokal) ---
        const secret = ethers.randomBytes(32);
        
        console.log(`[2/5] 📝 Menghitung hash komitmen (secara lokal)...`);
        const commitment = ethers.solidityPackedKeccak256(
            ['string', 'address', 'bytes32'],
            [normalizedLabel, ownerAddress, secret]
        );
        console.log(`   - Commitment Hash: ${commitment}`);

        // --- LANGKAH 3: Mengirim Transaksi 'commit' ---
        console.log(`[3/5] ✉️ Mengirim transaksi 'commit' ke blockchain...`);
        const commitTx = await contract.commit(commitment);
        await commitTx.wait();
        console.log(`   - Transaksi Commit berhasil! Hash: ${commitTx.hash}`);

        // --- LANGKAH 4: Menunggu ---
        const waitTime = Number(await contract.minCommitmentAge()) + 10;
        console.log(`[4/5] ⏳ Menunggu selama ${waitTime} detik...`);
        await sleep(waitTime * 1000);

        // --- LANGKAH 5: Mendaftarkan Label ---
        console.log(`[5/5] ✅ Mempersiapkan registrasi final...`);
        const duration = 31536000;

        console.log(`   - Menanyakan harga sewa ke smart contract...`);
        const priceData = await contract.rentPrice(normalizedLabel, duration);
        console.log("   - Struktur data harga mentah:", priceData);

        let finalPrice;
        if (typeof priceData === 'object' && priceData.base) {
            console.log('   - Harga terdeteksi sebagai STRUKTUR (base + premium). Menjumlahkan...');
            finalPrice = priceData.base + priceData.premium;
        } else {
            console.log('   - Harga terdeteksi sebagai NILAI TUNGGAL.');
            finalPrice = priceData;
        }
        console.log(`   - HARGA FINAL YANG AKAN DIKIRIM: ${ethers.formatUnits(finalPrice, "ether")} PHRS`);
        
        console.log(`   - Mengirim transaksi 'register' dengan harga yang tepat...`);
        const registerTx = await contract.register(normalizedLabel, ownerAddress, duration, secret, {
            value: finalPrice
        });
        await registerTx.wait();
        
        console.log(`\n🎉🎉 SELAMAT! BOT BERHASIL! 🎉🎉`);
        console.log(`Domain '${normalizedLabel}.phrs' berhasil didaftarkan untukmu!`);
        console.log(`   - Alamat Owner: ${ownerAddress}`);
        console.log(`   - Transaksi Register Hash: ${registerTx.hash}`);

    } catch (error) {
        console.error("\n🔥 Terjadi kesalahan:", error);
    }
}

registerDomain("seleraratyudp.phrs");
