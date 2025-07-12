// bot.js - Skrip Final dengan Koreksi Terakhir

// 1. Impor library
require('dotenv').config();
const { ethers } = require('ethers');

// 2. Konfigurasi
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REGISTRAR_CONTRACT_ADDRESS = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";

// 3. ABI dengan semua fungsi camelCase
const REGISTRAR_ABI = [
    "function available(string memory name) view returns(bool)",
    "function minCommitmentAge() view returns (uint256)",
    "function rentPrice(string memory name, uint256 duration) view returns(uint256)",
    "function commit(bytes32 commitment) external",
    "function resolver() view returns (address)",
    // PERUBAHAN FINAL: Menggunakan 'register' dengan r kecil
    "function register(string calldata name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) external payable"
];
const RESOLVER_ABI = [
    "function setAddr(bytes32 node, address a)"
];

// 4. Koneksi
if (!PHAROS_RPC_URL || !PRIVATE_KEY) throw new Error("Harap isi RPC_URL dan PRIVATE_KEY di .env");
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(REGISTRAR_CONTRACT_ADDRESS, REGISTRAR_ABI, wallet);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function registerDomain(label) {
    const tld = "phrs";
    const fullNormalizedName = `${ethers.ensNormalize(label)}.${tld}`;
    console.log(`🚀 Memulai registrasi untuk '${fullNormalizedName}'...`);

    try {
        const ownerAddress = await wallet.getAddress();
        const duration = 31536000;

        // LANGKAH 1: Cek Ketersediaan
        console.log("[1/5] Mengecek ketersediaan...");
        const isAvailable = await contract.available(label);
        if (!isAvailable) throw new Error(`Domain '${label}' tidak tersedia.`);
        console.log("✅ Domain tersedia.");

        // LANGKAH 2: Buat Komitmen
        console.log("[2/5] Membuat komitmen...");
        const secret = ethers.randomBytes(32);
        const commitment = ethers.solidityPackedKeccak256(['string', 'address', 'bytes32'], [label, ownerAddress, secret]);
        console.log("✅ Komitmen dibuat.");

        // LANGKAH 3: Commit
        console.log("[3/5] Mengirim transaksi 'commit'...");
        const commitTx = await contract.commit(commitment);
        await commitTx.wait();
        console.log(`✅ Commit berhasil: ${commitTx.hash}`);

        // LANGKAH 4: Menunggu
        const waitTime = Number(await contract.minCommitmentAge()) + 15;
        console.log(`[4/5] Menunggu selama ${waitTime} detik...`);
        await sleep(waitTime * 1000);

        // LANGKAH 5: Registrasi Final
        console.log("[5/5] Mempersiapkan registrasi final...");
        const price = await contract.rentPrice(label, duration);
        const resolverAddress = await contract.resolver();
        const node = ethers.namehash(fullNormalizedName);
        const resolverInterface = new ethers.Interface(RESOLVER_ABI);
        const dataPayload = [resolverInterface.encodeFunctionData("setAddr", [node, ownerAddress])];
        
        console.log("   - Mengirim transaksi 'register'...");
        // PERUBAHAN FINAL: Memanggil 'register' dengan r kecil
        const registerTx = await contract.register(
            label, ownerAddress, duration, secret, resolverAddress,
            dataPayload, false, 0, { value: price }
        );
        await registerTx.wait();
        
        console.log("\n🎉🎉🎉 PENDAFTARAN SUKSES! 🎉🎉🎉");
        console.log(`Domain '${fullNormalizedName}' telah terdaftar.`);
        console.log(`Tx Hash: ${registerTx.hash}`);

    } catch (error) {
        console.error("\n🔥🔥🔥 GAGAL 🔥🔥🔥");
        console.error(error.reason || error.message);
    }
}

// Ganti label di bawah ini dan jalankan
registerDomain("patnerfinasl");
