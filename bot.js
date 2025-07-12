#!/usr/bin/env node

// bot.js - Skrip Refactored & Wrapped dalam IIFE
// Pastikan menjalankannya dengan: node bot.js

require('dotenv').config();
const { ethers } = require('ethers');

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY     = process.env.PRIVATE_KEY;
const REGISTRAR_ADDR  = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER = "0x9a43dca1c3bb268546b98eb2ab1401bfc5b58505";

// 1. ABI
const REGISTRAR_ABI = [
  "function available(string name) view returns (bool)",
  "function commitments(bytes32 commitment) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function rentPrice(string name, uint256 duration) view returns (uint256)",
  "function commit(bytes32 commitment)",
  "function resolver() view returns (address)",
  "function register(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) payable"
];
const RESOLVER_ABI = [
  "function setAddr(bytes32 node, address a)"
];

// Setup provider & kontrak
if (!PHAROS_RPC_URL || !PRIVATE_KEY) throw new Error("PHAROS_RPC_URL dan PRIVATE_KEY harus diisi di .env");
const provider  = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet    = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet);

// Helper
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Debug: callStatic untuk register\async function debugRegister(label, owner, duration, secret, price) {
  const node  = ethers.namehash(`${label}.phrs`);
  const data  = [new ethers.Interface(RESOLVER_ABI).encodeFunctionData("setAddr", [node, owner])];
  try {
    await registrar.callStatic.register(label, owner, duration, secret, PUBLIC_RESOLVER, data, false, 0, { value: price });
  } catch (e) {
    console.error("⛔️ Debug Revert:", e.errorName || e.reason || e.data);
    throw e;
  }
}

// Main
async function registerDomain(label) {
  console.log(`🚀 Registrasi '${label}.phrs' dimulai`);
  const owner    = await wallet.getAddress();
  const duration = 31536000;

  // 1. Cek availability
  if (!(await registrar.available(label))) throw new Error('Domain tidak tersedia');
  console.log('✅ Available');

  // 2. Komitmen
  const secret     = ethers.randomBytes(32);
  const commitment = ethers.solidityPackedKeccak256(['string','address','bytes32'], [label, owner, secret]);
  await registrar.commit(commitment);
  console.log('✅ Commit dikirim');

  // Debug timing
  const commitTime = await registrar.commitments(commitment);
  const block1     = await provider.getBlock('latest');
  const minAge     = await registrar.minCommitmentAge();
  let waitTime     = Math.max(0, minAge - (block1.timestamp - commitTime)) + 60;
  console.log(`⏱ Menunggu ${waitTime}s`);
  await sleep(waitTime * 1000);

  // 3. Final register
  const price = await registrar.rentPrice(label, duration);
  await debugRegister(label, owner, duration, secret, price);
  const node  = ethers.namehash(`${label}.phrs`);
  const data  = [new ethers.Interface(RESOLVER_ABI).encodeFunctionData("setAddr", [node, owner])];
  const tx    = await registrar.register(label, owner, duration, secret, PUBLIC_RESOLVER, data, false, 0, { value: price });
  await tx.wait();
  console.log(`🎉 Sukses: ${tx.hash}`);
}

// IIFE Entry Point
(async () => {
  try {
    await registerDomain('patnerfinal');
  } catch (err) {
    console.error('🔥 Fatal Error:', err.message || err);
  }
})();
