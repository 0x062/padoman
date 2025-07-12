// bot.js - Skrip Refactored dengan Debug & Validasi

// 1. Impor & Konfigurasi
env (3) from .env (tip: ⚙️  write to custom object with { processEnv: myObject })
require('dotenv').config();
const { ethers } = require('ethers');

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY        = process.env.PRIVATE_KEY;
const REGISTRAR_ADDRESS  = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER    = "0x9a43dca1c3bb268546b98eb2ab1401bfc5b58505";

// 2. ABI
const REGISTRAR_ABI = [
  "function available(string name) view returns(bool)",
  "function minCommitmentAge() view returns(uint256)",
  "function rentPrice(string name, uint256 duration) view returns(uint256)",
  "function commit(bytes32 commitment)",
  "function resolver() view returns(address)",
  "function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses) payable"
];
const RESOLVER_ABI = ["function setAddr(bytes32 node, address a)"];

// 3. Setup provider & kontrak
if (!PHAROS_RPC_URL || !PRIVATE_KEY) {
  throw new Error("Harap isi PHAROS_RPC_URL dan PRIVATE_KEY di .env");
}
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDRESS, REGISTRAR_ABI, wallet);

// Helper
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Debug helper: callStatic untuk register
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
      0,       // ownerControlledFuses coba 0 dulu
      { value: price }
    );
  } catch(err) {
    console.error("⛔️ Debug Revert:", err.errorName || err.reason || err.data);
    throw err;
  }
}

// Main
async function registerDomain(label) {
  console.log(`🚀 Mulai: registrasi '${label}.phrs'`);

  const owner    = await wallet.getAddress();
  const duration = 31536000;
  const fullName = `${label}.phrs`;

  // Validasi resolver onchain
  const onchainResolver = await registrar.resolver();
  console.log(`🔍 Resolver onchain: ${onchainResolver}`);
  if (onchainResolver.toLowerCase() !== PUBLIC_RESOLVER.toLowerCase()) {
    console.warn("⚠️ Address resolver mismatch dengan PUBLIC_RESOLVER");
  }

  // 1. Cek availability
  console.log("[1/5] Mengecek ketersediaan...");
  if (!(await registrar.available(label))) {
    throw new Error(`Domain '${fullName}' tidak tersedia`);
  }
  console.log("✅ Tersedia");

  // 2. Buat commitment
  console.log("[2/5] Buat komitmen...");
  const secret     = ethers.randomBytes(32);
  const commitment = ethers.solidityPackedKeccak256(
    ['string','address','bytes32'],
    [label, owner, secret]
  );
  console.log("✅ Komitmen siap");

  // 3. Submit commit
  console.log("[3/5] Kirim commit tx...");
  const txCommit = await registrar.commit(commitment);
  await txCommit.wait();
  console.log(`✅ Commit TX: ${txCommit.hash}`);

  // 4. Tunggu minCommitmentAge + buffer
  const waitTime = Number(await registrar.minCommitmentAge()) + 15;
  console.log(`[4/5] Tunggu ${waitTime}s...`);
  await sleep(waitTime * 1000);

  // 5. Debug & Register
  console.log("[5/5] Siapkan final registration...");
  const price = await registrar.rentPrice(label, duration);

  // Jalankan callStatic untuk debug revert
  await debugRegister(label, owner, duration, secret, price);

  // Submit register tx
  console.log("   - Kirim register tx...");
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
    0,           // ownerControlledFuses = 0
    { value: price }
  );

  await txReg.wait();
  console.log(`🎉 Domain '${fullName}' terdaftar: ${txReg.hash}`);
}

// Panggil fungsi
registerDomain("patnerfinal");
