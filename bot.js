// bot.js - Versi Deteksi & Debug Register

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

const RESOLVER_ABI = [
  "function setAddr(bytes32 node, address a)"
];

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet);

const sleep = ms => new Promise(res => setTimeout(res, ms));
const fixedSecret = "0x5de29eca00000003935763085462311afa8e25ef75762ae00ef4a9066fe0140c"; // Secret dari tx sukses

async function registerDomain(label) {
  const owner = await wallet.getAddress();
  const duration = 31536000;
  const fullName = `${label}.phrs`;
  const node = ethers.namehash(fullName);
  const secret = fixedSecret;

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

  const resolverInterface = new ethers.Interface(RESOLVER_ABI);
  const data = [
    resolverInterface.encodeFunctionData("setAddr", [node, owner])
  ];
  console.log("✅ Data payload siap:", data);

  try {
    console.log("🔍 Pre-check callStatic.register...");
    await registrar.callStatic["register"](
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

    console.log("🚀 Mengirim transaksi 'register'...");
    const registerTx = await registrar.register(
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
    await registerTx.wait();

    console.log(`\n🎉🎉🎉 DOMAIN BERHASIL TERDAFTAR! 🎉🎉🎉`);
    console.log(`   - TX HASH: ${registerTx.hash}`);
  } catch (err) {
    console.error("\n🔥🔥🔥 GAGAL 🔥🔥🔥");
    console.error("   - label:", label);
    console.error("   - owner:", owner);
    console.error("   - duration:", duration);
    console.error("   - secret:", secret);
    console.error("   - resolver:", PUBLIC_RESOLVER);
    console.error("   - data:", data);
    console.error("   - value:", price.toString());
    console.error("   - Pesan:", err?.reason || err?.errorName || err?.message || "Unknown error");
  }
}

(async () => {
  try {
    await registerDomain("gunakanituku"); // Ganti domain di sini
  } catch (err) {
    console.error("\n🔥🔥🔥 ERROR LUAR 🔥🔥🔥");
    console.error("   - Pesan:", err?.message || err);
  }
})();
