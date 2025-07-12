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
    "function rentPrice(string memory name, uint256 duration) view returns(uint256)",
    "function Commit(bytes32 commitment) external",
    "function resolver() view returns (address)",
    // PERUBAHAN DI SINI: ganti "register" menjadi "Register"
    "function Register(string calldata name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) external payable"
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
 * Fungsi utama untuk mendaftarkan domain secara lengkap
 * @param {string} fullDomainName - Nama domain lengkap yang ingin didaftarkan (contoh: "domainkeren.phrs")
 */
async function registerDomain(fullDomainName) {
    const tld = "phrs"; // Definisikan TLD di sini
    const label = fullDomainName.split('.')[0];
    if (!label) {
        console.error(`❌ Nama domain tidak valid: '${fullDomainName}'`);
        return;
    }
    const normalizedLabel = ethers.ensNormalize(label);
    const fullNormalizedName = `${normalizedLabel}.${tld}`;

    console.log(`✅ Memproses domain '${fullNormalizedName}' dengan label: '${normalizedLabel}'`);
    console.log(`🚀 Memulai proses registrasi...`);

    try {
        const ownerAddress = await wallet.getAddress();

        // LANGKAH 1 & 2: Cek Ketersediaan & Buat Komitmen
        console.log("[1 & 2] Mengecek ketersediaan & membuat komitmen...");
        const isAvailable = await contract.available(normalizedLabel);
        if (!isAvailable) throw new Error(`Label '${normalizedLabel}' sudah terdaftar.`);
        const secret = ethers.randomBytes(32);
        const commitment = ethers.solidityPackedKeccak256(
            ['string', 'address', 'bytes32'],
            [normalizedLabel, ownerAddress, secret]
        );
        console.log(`✅ Ketersediaan & Komitmen OK.`);

        // LANGKAH 3: Commit
        console.log("[3] Mengirim transaksi 'commit'...");
        const commitTx = await contract.Commit(commitment);
        await commitTx.wait();
        console.log(`✅ Commit berhasil! Hash: ${commitTx.hash}`);

        // LANGKAH 4: Menunggu
        const waitTime = Number(await contract.minCommitmentAge()) + 15; // Tambah buffer jadi 15 detik
        console.log(`[4] Menunggu selama ${waitTime} detik...`);
        await sleep(waitTime * 1000);

        // LANGKAH 5: Mempersiapkan & Melakukan Registrasi Final
        console.log("[5] Mempersiapkan registrasi final...");
        const duration = 31536000; // 1 tahun

        // 5a. Dapatkan harga sewa
        const registrationPrice = await contract.rentPrice(normalizedLabel, duration);
        console.log(`   - Harga sewa didapat: ${ethers.formatEther(registrationPrice)} PHRS`);

        // 5b. Dapatkan alamat resolver default dari kontrak registrar
        const resolverAddress = await contract.resolver();
        console.log(`   - Alamat resolver didapat: ${resolverAddress}`);

        // 5c. Siapkan "data payload" untuk menginstruksikan resolver
        const node = ethers.namehash(fullNormalizedName);
        const resolverInterface = new ethers.Interface(RESOLVER_ABI);
        const dataPayload = [
            resolverInterface.encodeFunctionData("setAddr", [node, ownerAddress])
        ];
        console.log(`   - Data payload untuk resolver berhasil dibuat.`);

        // 5d. Kirim transaksi Register dengan SEMUA argumen
        console.log("   - Mengirim transaksi 'Register' dengan data lengkap...");
        const registerTx = await contract.Register(
            normalizedLabel,
            ownerAddress,
            duration,
            secret,
            resolverAddress,      // Argumen ke-5: Alamat resolver
            dataPayload,          // Argumen ke-6: Instruksi untuk resolver
            false,                // Argumen ke-7: reverseRecord (biasanya false)
            0,                    // Argumen ke-8: ownerControlledFuses (0 untuk default)
            { value: registrationPrice }
        );
        await registerTx.wait();
        
        console.log("\n\n🎉🎉🎉 CONGRATULATIONS, IT'S DONE! 🎉🎉🎉");
        console.log(`Domain '${fullNormalizedName}' telah berhasil didaftarkan untukmu!`);
        console.log(`   - Owner: ${ownerAddress}`);
        console.log(`   - Resolver: ${resolverAddress}`);
        console.log(`   - Tx Hash: ${registerTx.hash}`);

    } catch (error) {
        console.error("\n🔥🔥🔥 TERJADI KESALAHAN FATAL 🔥🔥🔥");
        console.error(error);
    }
}

registerDomain("seleraratddyudp.phrs");
