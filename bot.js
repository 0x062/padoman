// bot.js - Skrip Final Berdasarkan Bukti Decode

require('dotenv').config();
const { ethers } = require('ethers');

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REGISTRAR_ADDR = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER = "0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505";

const REGISTRAR_ABI = [
  "function available(string) view returns (bool)",
  "function commitments(bytes32) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function rentPrice(string,uint256) view returns (uint256)",
  "function commit(bytes32)",
  "function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable"
];

// ABI minimal untuk resolver, hanya untuk meng-encode data
const RESOLVER_ABI = [
    "function setAddr(bytes32 node, address a)"
];

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet);

const sleep = ms => new Promise(res => setTimeout(res, ms));
const secret = ethers.randomBytes(32); // Definisikan secret sekali agar konsisten

async function registerDomain(label) {
  const owner = await wallet.getAddress();
  const duration = 31536000; // 1 tahun
  const fullName = `${label}.phrs`;
  const node = ethers.namehash(fullName);

  console.log(`\n🚀 Memulai registrasi '${fullName}'...`);

  const available = await registrar.available(label);
  if (!available) throw new Error("Domain tidak tersedia!");
  console.log(`✅ Domain tersedia`);

  const commitment = ethers.solidityPackedKeccak256(['string', 'address', 'bytes32'], [label, owner, secret]);

  const commitTx = await registrar.commit(commitment);
  await commitTx.wait();
  console.log(`✅ Commit tx: ${commitTx.hash}`);

  const commitTime = Number(await registrar.commitments(commitment));
  const currentBlock = await provider.getBlock('latest');
  const now = currentBlock.timestamp;
  const minWait = Number(await registrar.minCommitmentAge());
  const delay = Math.max(0, minWait - (now - commitTime)) + 15;

  console.log(`⏱ Menunggu ${delay} detik...`);
  await sleep(delay * 1000);

  const price = await registrar.rentPrice(label, duration);

  // =================================================================
  // PERBAIKAN FINAL: Kita kembalikan pembuatan data payload
  const resolverInterface = new ethers.Interface(RESOLVER_ABI);
  const data = [
      resolverInterface.encodeFunctionData("setAddr", [node, owner])
  ];
  console.log("✅ Data payload untuk resolver berhasil dibuat.");
  // =================================================================

  console.log("🚀 Mengirim transaksi 'register' final...");
  const registerTx = await registrar.register(
    label,
    owner,
    duration,
    secret,
    PUBLIC_RESOLVER,
    data, // Menggunakan data payload yang sudah dibuat
    false,
    0,
    { value: price }
  );

  await registerTx.wait();
  console.log(`\n🎉🎉🎉 DOMAIN BERHASIL TERDAFTAR! 🎉🎉🎉`);
  console.log(`   - TX HASH: ${registerTx.hash}`);
}

(async () => {
  try {
    await registerDomain("pahdjkspe");
  } catch (err) {
    console.error("\n🔥🔥🔥 GAGAL 🔥🔥🔥");
    console.error("   - Pesan:", err.reason || err.message);
  }
})();
