// bot.js – Registrar Debug dengan Validasi callStatic

import 'dotenv/config';
import { ethers } from 'ethers';


// ===== Konstanta =====
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY    = process.env.PRIVATE_KEY;
const REGISTRAR      = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER= "0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505";

// ===== ABI =====
const REG_ABI = [
  "function available(string) view returns(bool)",
  "function commitments(bytes32) view returns(uint256)",
  "function minCommitmentAge() view returns(uint256)",
  "function rentPrice(string,uint256) view returns(uint256)",
  "function commit(bytes32)",
  "function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable"
];
const RESOLVER_ABI = ["function setAddr(bytes32,address)"];

// ===== Setup =====
const provider  = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet    = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR, REG_ABI, wallet);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Gunakan secret tetap agar sama di commit & register
const SECRET_FIXED = "0x5de29eca00000003935763085462311afa8e25ef75762ae00ef4a9066fe0140c";

async function registerDomain(label) {
  const owner    = await wallet.getAddress();
  const duration = 31536000;
  const full     = `${label}.phrs`;
  const node     = ethers.namehash(full);

  console.log(`\n🚀 Mulai registrasi '${full}'`);

  // 1. Cek ketersediaan
  if (!(await registrar.available(label))) throw new Error("Domain tidak tersedia");
  console.log("✅ Domain tersedia");

  // 2. Commit
  const commitment = ethers.solidityPackedKeccak256([
    'string','address','bytes32'
  ], [label, owner, SECRET_FIXED]);
  const txC = await registrar.commit(commitment); await txC.wait();
  console.log("✅ Commit TX:", txC.hash);

  // 3. Tunggu minCommitmentAge
  const cTime = Number(await registrar.commitments(commitment));
  const now   = (await provider.getBlock('latest')).timestamp;
  const min   = Number(await registrar.minCommitmentAge());
  const wait  = Math.max(0, min - (now - cTime)) + 20; // extra buffer
  console.log(`⏱ Tunggu ${wait}s ...`);
  await sleep(wait*1000);

  // 4. Hitung harga
  const price = await registrar.rentPrice(label, duration);

  // 5. Build data[] kosong (versi tx sukses) atau setAddr jika mau
  const data = [];

  // 6. Validasi callStatic.register ada
  if (typeof registrar.callStatic?.register !== 'function') {
    throw new Error("❌ registrar.callStatic.register tidak ditemukan; periksa ABI atau instance kontrak");
  }

  console.log("🔍 callStatic.register pre-check ...");
  try {
    await registrar.callStatic.register(
      label, owner, duration, SECRET_FIXED,
      PUBLIC_RESOLVER, data, false, 0,
      { value: price }
    );
  } catch (e) {
    console.error("⛔ Revert callStatic:", e.errorName || e.reason || e.message);
    return; // stop jika masih revert
  }
  console.log("✅ callStatic lolos – kirim tx.");

  // 7. Kirim register
  const txR = await registrar.register(
    label, owner, duration, SECRET_FIXED,
    PUBLIC_RESOLVER, data, false, 0,
    { value: price }
  );
  await txR.wait();
  console.log(`🎉 Sukses! TX: ${txR.hash}`);
}

// GANTI label di sini
registerDomain("gunakanituku").catch(err => {
  console.error("🔥 Error:", err.message || err);
});
