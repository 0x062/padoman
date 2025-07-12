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

// 3. Submit commit and debug timing
  console.log("[3/5] Mengirim commit tx...");
  const txCommit = await registrar.commit(commitment);
  await txCommit.wait();
  console.log(`✅ Commit TX: ${txCommit.hash}`);

  // Ambil commitTime, current block, dan minAge
  const commitTime = await registrar.commitments(commitment);
  const block      = await provider.getBlock("latest");
  const minAge     = await registrar.minCommitmentAge();
  console.log(`🕒 commitTime: ${commitTime}`);
  console.log(`🕒 block.timestamp before wait: ${block.timestamp}`);
  console.log(`🔍 minCommitmentAge: ${minAge} detik`);

  // Hitung waktu tunggu sisa + buffer lebih besar
  let waitTime = minAge - (block.timestamp - commitTime);
  if (waitTime < 0) waitTime = 0;
  // Tambah buffer 60 detik untuk keamanan
  waitTime += 60;
  console.log(`[4/5] Menunggu ${waitTime}s sebelum registrasi...`);
  await sleep(waitTime * 1000);
  // Cek timestamp pasca tunggu
  const afterBlock = await provider.getBlock("latest");
  console.log(`🕒 block.timestamp after wait: ${afterBlock.timestamp}`);

  console.log("[5/5] Menjalankan final register...");

  // 4. Debug & register final
  console.log("[5/5] Mempersiapkan registrasi final...");
  const price = await registrar.rentPrice(label, duration);
  await debugRegister(label, owner, duration, secret, price);

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
registerDomain("patnerfinal").catch(err => console.error("🔥 Fatal Error:", err.message || err));
