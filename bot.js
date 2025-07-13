import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function commit(bytes32)',
  'function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses) payable'
]
const RESOLVER_ABI = ['function setAddr(bytes32 node, address a)']

const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)
const resolverInterface = new Interface(RESOLVER_ABI)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const secret = ethers.randomBytes(32)

async function registerDomain(label) {
  const owner = await wallet.getAddress()
  const duration = 31536000n 
  const normalizedLabel = ethers.ensNormalize(label)
  const fullName = `${normalizedLabel}.phrs`
  const node = namehash(fullName)
  const reverseRecord = false;
  const ownerControlledFuses = 0;

  console.log(`\n🚀 Mulai registrasi '${fullName}'`)

  if (!(await registrar.available(normalizedLabel))) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  // Siapkan data untuk resolver SEBELUM membuat commitment
  const dataForResolver = [resolverInterface.encodeFunctionData('setAddr', [node, owner])]

  // ✅ PERBAIKAN FINAL: Membuat commitment hash dengan SEMUA argumen yang relevan
  const commitment = ethers.solidityPackedKeccak256(
    ['string', 'address', 'uint256', 'bytes32', 'address', 'bytes[]', 'bool', 'uint16'],
    [normalizedLabel, owner, duration, secret, PUBLIC_RESOLVER, dataForResolver, reverseRecord, ownerControlledFuses]
  );
  console.log(`[DEBUG] Commitment hash (resep lengkap) dibuat: ${commitment}`);

  console.log('1️⃣ Mengirim transaksi "commit"...')
  const txCommit = await registrar.commit(commitment) 
  await txCommit.wait()
  console.log(`✅ Commit berhasil, tx: ${txCommit.hash}`)

  const minWaitTime = await registrar.minCommitmentAge()
  const waitTimeWithBuffer = minWaitTime + 15n 
  console.log(`⏱  Menunggu ${waitTimeWithBuffer.toString()} detik...`)
  await sleep(Number(waitTimeWithBuffer) * 1000)

  const price = await registrar.rentPrice(normalizedLabel, duration)
  const priceWithBuffer = (price * 105n) / 100n; 
  console.log(`[i] Harga dasar: ${ethers.formatEther(price)} PHRS`)
  console.log(`[i] Harga dengan buffer 5%: ${ethers.formatEther(priceWithBuffer)} PHRS`)
  
  console.log('2️⃣ Mengirim transaksi "register" langsung...')
  const txRegister = await registrar.register(
    normalizedLabel,
    owner,
    duration,
    secret,
    PUBLIC_RESOLVER,
    dataForResolver,
    reverseRecord,
    ownerControlledFuses,
    { 
      value: priceWithBuffer, 
      gasLimit: 500000 
    }
  )

  await txRegister.wait()
  console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`   Tx Hash: ${txRegister.hash}`)
}

// Ganti dengan label baru
const newLabel = 'akhirnyaberhasil' 
registerDomain(newLabel).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan Singkat: ${err.reason || err.message}`)
  console.error('   - Detail Error Lengkap:', err) 
})
