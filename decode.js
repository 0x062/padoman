import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'

// ===================================================================================
// ⚙️ PENGATURAN - GANTI HASH TRANSAKSI DI SINI
// ===================================================================================

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL

// Ganti dengan hash dari transaksi COMMIT manual Anda yang berhasil
const COMMIT_TX_HASH   = "0x4b6842b14a13a590d516d6986348486981b9125597914bfc8298a51915e55496"; 

// Ganti dengan hash dari transaksi REGISTER manual Anda yang berhasil
const REGISTER_TX_HASH = "0xcaf6a6ecfb264e956003c68ecf3982808274bd90cd96fc153aaa1406a1a2cefd";

// ===================================================================================
// 🛠️ SKRIP ANALISIS
// ===================================================================================

// BENAR
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
// Gabungkan semua ABI yang mungkin untuk di-decode
const REGISTRAR_ABI = [
    'function commit(bytes32)',
    'function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses)'
];
const iface = new Interface(REGISTRAR_ABI);

async function verifyFlow() {
    console.log(" Menganalisis Alur Commit -> Register ".padStart(50, '=').padEnd(80, '='));
    console.log(`[i] Tx Commit  : ${COMMIT_TX_HASH}`);
    console.log(`[i] Tx Register: ${REGISTER_TX_HASH}`);
    console.log("".padEnd(80, '='));

    if (COMMIT_TX_HASH.startsWith('GANTI_DENGAN') || REGISTER_TX_HASH.startsWith('GANTI_DENGAN')) {
        throw new Error("Harap ganti nilai HASH transaksi di dalam skrip terlebih dahulu.");
    }

    // --- Langkah 1: Bedah Transaksi COMMIT ---
    console.log("\n1️⃣  Membedah transaksi Commit...");
    const commitTx = await provider.getTransaction(COMMIT_TX_HASH);
    if (!commitTx) throw new Error("Transaksi Commit tidak ditemukan.");
    
    const decodedCommit = iface.parseTransaction({ data: commitTx.data });
    if (!decodedCommit || decodedCommit.name !== 'commit') {
        throw new Error("Gagal men-decode transaksi Commit atau nama fungsi bukan 'commit'.");
    }
    
    const onChainCommitmentHash = decodedCommit.args[0];
    console.log(`[+] Hash yang dikirim di 'commit'  : ${onChainCommitmentHash}`);

    // --- Langkah 2: Bedah Transaksi REGISTER ---
    console.log("\n2️⃣  Membedah transaksi Register...");
    const registerTx = await provider.getTransaction(REGISTER_TX_HASH);
    if (!registerTx) throw new Error("Transaksi Register tidak ditemukan.");

    const decodedRegister = iface.parseTransaction({ data: registerTx.data });
    if (!decodedRegister || decodedRegister.name !== 'register') {
        throw new Error("Gagal men-decode transaksi Register atau nama fungsi bukan 'register'.");
    }
    
    console.log("[+] Argumen dari 'register' berhasil di-decode.");
    const [name, owner, duration, secret, resolver, data, reverseRecord, fuses] = decodedRegister.args;

    // --- Langkah 3: Buat Ulang Hash Secara Lokal ---
    console.log("\n3️⃣  Membuat ulang commitment hash dari data Register...");
    
    const locallyGeneratedHash = ethers.solidityPackedKeccak256(
        ['string', 'address', 'uint256', 'bytes32', 'address', 'bytes[]', 'bool', 'uint16'],
        [name, owner, duration, secret, resolver, data, reverseRecord, fuses]
    );
    console.log(`[i] Hash yang dibuat ulang lokal: ${locallyGeneratedHash}`);

    // --- Langkah 4: Validasi ---
    console.log("\n4️⃣  Memvalidasi kecocokan hash...");
    console.log("".padEnd(80, '-'));
    
    if (onChainCommitmentHash === locallyGeneratedHash) {
        console.log("✅ SINKRON & VALID!");
        console.log("   'Resep' hash kita sudah 100% benar.");
    } else {
        console.log("❌ TIDAK SINKRON!");
        console.log("   'Resep' hash kita masih salah atau ada data yang berbeda.");
        console.log(`   - Hash di 'commit'  : ${onChainCommitmentHash}`);
        console.log(`   - Hash dari 'register': ${locallyGeneratedHash}`);
    }
    console.log("".padEnd(80, '-'));
}

verifyFlow().catch(err => {
    console.error("\n🔥🔥🔥 ANALISIS GAGAL 🔥🔥🔥");
    console.error(`  - Pesan: ${err.message}`);
});
