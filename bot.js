

// bot.js - Skrip Refactored & Wrapped dalam IIFE
// Pastikan menjalankannya dengan: node bot.js

require('dotenv').config();
const { ethers } = require('ethers');

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY     = process.env.PRIVATE_KEY;
const REGISTRAR_ADDR  = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER = "0x9a43dca1c3bb268546b98eb2ab1401bfc5b58505";

// ABI Registrar
const REGISTRAR_ABI = [
  "function available(string name) view returns(bool)",
  "function commitments(bytes32 commitment) view returns(uint256)",
  "function minCommitmentAge() view returns(uint256)",
  "function rentPrice(string name,uint256 duration) view returns(uint256)",
  "function commit(bytes32 commitment)",
  "function resolver() view returns(address)",
  "function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses) payable"
];

// ABI Resolver
const RESOLVER_ABI = [
  "function setAddr(bytes32 node,address a)"
];

// Validasi env
if (!PHAROS_RPC_URL || !PRIVATE_KEY) {
  console.error("⚠️ PHAROS_RPC_URL dan PRIVATE_KEY harus diset di .env");
  process.exit(1);
}

const provider  = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet    = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet);

// Delay helper
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Debug callStatic register to get revert reason
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

// Main function: register domain
async function registerDomain(label) {
  console.log(`🚀 Registrasi '${label}.phrs' dimulai`);
  const owner    = await wallet.getAddress();
  const duration = 31536000; // 1 tahun

  // 1. Check availability
  const available = await registrar.available(label);
  if (!available) {
    throw new Error(`Domain '${label}.phrs' tidak tersedia`);
  }
  console.log(`✅ Domain tersedia`);

  // 2. Commit
  const secret     = ethers.randomBytes(32);
  const commitment = ethers.solidityPackedKeccak256(
    ['string','address','bytes32'],
    [label, owner, secret]
  );
  const txCommit = await registrar.commit(commitment);
  await txCommit.wait();
  console.log(`✅ Commit TX: ${txCommit.hash}`);

  // Debug timing
  const commitTime = await registrar.commitments(commitment);
  const block1     = await provider.getBlock('latest');
  const minAge     = await registrar.minCommitmentAge();
  let waitTime     = Math.max(0, minAge - (block1.timestamp - commitTime)) + 60;
  console.log(`⏱ Menunggu ${waitTime}s sebelum registrasi`);
  await sleep(waitTime * 1000);

  // 3. Final register
  const price      = await registrar.rentPrice(label, duration);
  await debugRegister(label, owner, duration, secret, price);
  const node       = ethers.namehash(`${label}.phrs`);
  const iface      = new ethers.Interface(RESOLVER_ABI);
  const data       = [iface.encodeFunctionData("setAddr", [node, owner])];
  const txRegister = await registrar.register(
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
  await txRegister.wait();
  console.log(`🎉 Domain berhasil terdaftar, TX: ${txRegister.hash}`);
}

// IIFE entry point
(async () => {
  try {
    await registerDomain('patnerfinal');
  } catch (err) {
    console.error('🔥 Fatal Error:', err.message || err);
  }
})();
