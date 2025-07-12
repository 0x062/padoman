// bot.js - Skrip Refactored dengan Debug & Validasi

// 1. Impor & Konfigurasi
require('dotenv').config();
const { ethers } = require('ethers');

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY     = process.env.PRIVATE_KEY;
const REGISTRAR_ADDR  = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER = "0x9a43dca1c3bb268546b98eb2ab1401bfc5b58505";

// 2. ABI
const REGISTRAR_ABI = [
  "function available(string name) view returns (bool)",
  "function minCommitmentAge() view returns (uint256)",
  "function rentPrice(string name, uint256 duration) view returns (uint256)",
  "function commitments(bytes32 commitment) view returns (uint256)",  // added to debug timing
  "function commit(bytes32 commitment)",
  "function resolver() view returns (address)",
  "function register(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) payable"
];
  "function available(string name) view returns (bool)",
  "function minCommitmentAge() view returns (uint256)",
  "function rentPrice(string name, uint256 duration) view returns (uint256)",
  "function commit(bytes32 commitment)",
  "function resolver() view returns (address)",
  "function register(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) payable"
];
const RESOLVER_ABI = [
  "function setAddr(bytes32 node, address a)"
];

// 3. Setup provider & kontrak
if (!PHAROS_RPC_URL || !PRIVATE_KEY) {
  throw new Error("Harap isi PHAROS_RPC_URL dan PRIVATE_KEY di .env");
}

const provider  = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet    = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet);

// Helper: delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms)); => new Promise(resolve => setTimeout(resolve, ms));

// Debug: callStatic untuk register
async function debugRegister(label, owner, duration, secret, price) {
  const fullName = `${label}.phrs`;
  const node     = ethers.namehash(fullName);
  const iface    = new ethers.Interface(RESOLVER_ABI);
  const data     = [iface.encodeFunctionData("setAddr", [node, owner])];

  try {
    await registrar.callStatic.register(
      label,
      owner,
      duration,
      secret,
      PUBLIC_RESOLVER,
      data,
      false,
      0,
      { value: price }
    );
  } catch (err) {
    console.error("⛔️ Debug Revert:", err.errorName || err.reason || err.data);
    throw err;
  }
}

// Main: registrasi domain
async function registerDomain(label) {
  console.log(`🚀 Mulai registrasi '${label}.phrs'`);

  // Persiapan
  const owner    = await wallet.getAddress();
  const duration = 31536000; // 1 tahun
  const fullName = `${label}.phrs`;

  // Validasi resolver onchain
  const onchainResolver = await registrar.resolver();
  console.log(`🔍 Resolver onchain: ${onchainResolver}`);
  if (onchainResolver.toLowerCase() !== PUBLIC_RESOLVER.toLowerCase()) {
    console.warn("⚠️ Address resolver mismatch dengan PUBLIC_RESOLVER");
  }

  // 1. Cek availability
  console.log("[1/5] Mengecek ketersediaan...");
  const available = await registrar.available(label);
  if (!available) {
    throw new Error(`Domain '${fullName}' tidak tersedia`);
  }
  console.log("✅ Tersedia");

  // 2. Buat komitmen
  console.log("[2/5] Buat komitmen...");
  const secret     = ethers.randomBytes(32);
  const commitment = ethers.solidityPackedKeccak256(
    ['string', 'address', 'bytes32'],
    [label, owner, secret]
  );
  console.log("✅ Komitmen siap");

  // 3. Submit commit
  console.log("[3/5] Mengirim commit tx...");
  const txCommit = await registrar.commit(commitment);
  await txCommit.wait();
  console.log(`✅ Commit TX: ${txCommit.hash}`);

  // Debug: periksa waktu commit dan minCommitmentAge
  const commitTime = await registrar.commitments(commitment);
  const block = await provider.getBlock("latest");
  const minAge = await registrar.minCommitmentAge();
  console.log(`🕒 commitTime: ${commitTime} (timestamp)`);
  console.log(`🕒 current blockTime: ${block.timestamp}`);
  console.log(`🔍 minCommitmentAge: ${minAge} detik`);

  // 4. Tunggu waktu minimum
  const elapsed = block.timestamp - commitTime;
  const waitTime = (minAge - elapsed > 0 ? minAge - elapsed : 0) + 15;
  console.log(`[4/5] Menunggu ${waitTime}s...`);
  await sleep(waitTime * 1000);

  // Lanjut ke registration ${txCommit.hash}`);

  // 4. Tunggu waktu minimum
  const waitTime = Number(await registrar.minCommitmentAge()) + 15;
  console.log(`[4/5] Menunggu ${waitTime}s...`);
  await sleep(waitTime * 1000);

  // 5. Debug & Register
  console.log("[5/5] Siapkan registrasi final...");
  const price = await registrar.rentPrice(label, duration);

  // Debug callStatic
  await debugRegister(label, owner, duration, secret, price);

  // Kirim register tx
  console.log("   - Mengirim register tx...");
  const iface = new ethers.Interface(RESOLVER_ABI);
  const data  = [iface.encodeFunctionData("setAddr", [ethers.namehash(fullName), owner])];
  const txReg = await registrar.register(
    label,
    owner,
    duration,
    secret,
    PUBLIC_RESOLVER,
    data,
    false,
    0,
    { value: price }
  );
  await txReg.wait();

  console.log(`🎉 Domain '${fullName}' berhasil terdaftar! TX: ${txReg.hash}`);
}

// Jalankan dan tangani error
registerDomain("patnerfinal").catch(err => {
  console.error("🔥 Fatal Error:", err.message || err);
});
