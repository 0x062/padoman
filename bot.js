require('dotenv').config();
const { ethers } = require('ethers');

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REGISTRAR_ADDR = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";
const PUBLIC_RESOLVER = "0x9a43dca1c3bb268546b98eb2ab1401bfc5b58505";

const REGISTRAR_ABI = [
  "function available(string) view returns (bool)",
  "function commitments(bytes32) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function rentPrice(string,uint256) view returns (uint256)",
  "function commit(bytes32)",
  "function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable"
];

const RESOLVER_ABI = [
  "function setAddr(bytes32,address)"
];

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet);

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function registerDomain(label) {
  const owner = await wallet.getAddress();
  const duration = 31536000; // 1 tahun
  const fullName = `${label}.phrs`;
  const node = ethers.namehash(fullName);

  console.log(`🚀 Memulai registrasi '${fullName}'...`);

  const available = await registrar.available(label);
  if (!available) throw new Error("Domain tidak tersedia!");

  const secret = ethers.randomBytes(32);
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
  const resolver = new ethers.Interface(RESOLVER_ABI);
  const data = [resolver.encodeFunctionData("setAddr", [node, owner])];

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
  console.log(`🎉 Berhasil mendaftarkan '${fullName}'`);
  console.log(`🔗 TX Hash: ${registerTx.hash}`);
}

(async () => {
  try {
    await registerDomain("domainbarkuu"); // GANTI dengan nama domain target
  } catch (err) {
    console.error("🔥 ERROR:", err.reason || err.message || err);
  }
})();
