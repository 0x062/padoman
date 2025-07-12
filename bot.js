// Mengimpor library yang diperlukan dari ethers dan dotenv
import 'dotenv/config'
import { ethers, namehash, Interface } from 'ethers'

// --- KONFIGURASI ---
// Mengambil data dari file .env
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY

// Alamat kontrak yang sudah terbukti benar
const REGISTRAR_ADDR = '0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175'
const PUBLIC_RESOLVER = '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505'

// --- ABI (Antarmuka Kontrak) ---
// Berdasarkan fungsi-fungsi yang kita tahu digunakan: `available`, `commit`, `rentPrice`, dan `register`.
const REGISTRAR_ABI = [
  'function available(string) view returns (bool)',
  'function minCommitmentAge() view returns (uint256)',
  'function rentPrice(string,uint256) view returns (uint256)',
  'function commit(bytes32)',
  'function register(string,address,uint256,bytes32,address,bytes[],bool,uint16) payable'
]

// ABI minimal untuk membuat data payload bagi resolver
const RESOLVER_ABI = [
  'function setAddr(bytes32 node, address a)'
]

// --- Inisialisasi Ethers ---
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const registrar = new ethers.Contract(REGISTRAR_ADDR, REGISTRAR_ABI, wallet)
const resolverInterface = new Interface(RESOLVER_ABI)

// Fungsi bantuan untuk jeda
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Membuat secret sekali agar konsisten antara commit dan register
const secret = ethers.randomBytes(32)

/**
 * Fungsi utama untuk mendaftarkan domain
 * @param {string} label - Nama domain yang ingin didaftarkan (tanpa .phrs)
 */
async function registerDomain(label) {
  // --- Persiapan Parameter ---
  const owner = await wallet.getAddress()
  const duration = 31536000 // 1 tahun dalam detik
  const fullName = `${label}.phrs`
  const node = namehash(fullName)

  console.log(`\n🚀 Memulai registrasi untuk '${fullName}'...`)

  // --- Langkah 1: Cek Ketersediaan ---
  const isAvailable = await registrar.available(label)
  if (!isAvailable) throw new Error('Domain tidak tersedia')
  console.log('✅ Domain tersedia')

  // --- Langkah 2: Buat Komitmen ---
  const commitment = ethers.solidityPackedKeccak256(
    ['string', 'address', 'bytes32'],
    [label, owner, secret]
  )

  // --- Langkah 3: Kirim Transaksi Commit ---
  const txCommit = await registrar.commit(commitment)
  await txCommit.wait()
  console.log(`✅ Commit berhasil, tx: ${txCommit.hash}`)

  // --- Langkah 4: Menunggu Durasi ---
  const waitTime = Number(await registrar.minCommitmentAge()) + 15 // Menunggu sesuai aturan + 15 detik buffer
  console.log(`⏱  Menunggu selama ${waitTime} detik...`)
  await sleep(waitTime * 1000)

  // --- Langkah 5: Persiapan Transaksi Register ---
  const price = await registrar.rentPrice(label, duration)
  const dataPayload = [
    resolverInterface.encodeFunctionData('setAddr', [node, owner])
  ]
  console.log('✅ Persiapan registrasi final selesai')

  // --- Langkah 6: Kirim Transaksi Register Final ---
  console.log('🚀 Mengirim transaksi registrasi...')
  const txRegister = await registrar.register(
    label,            // Arg 1: 'gunakanitu'
    owner,            // Arg 2: Alamat Anda
    duration,         // Arg 3: 31536000n
    secret,           // Arg 4: Secret yang sama dengan saat commit
    PUBLIC_RESOLVER,  // Arg 5: Alamat Resolver yang benar
    dataPayload,      // Arg 6: Data untuk mengatur alamat
    false,            // Arg 7: Reverse record
    0,                // Arg 8: Fuses
    { value: price }  // Value: Harga sewa
  )

  await txRegister.wait()
  console.log(`\n🎉 SELAMAT! DOMAIN BERHASIL TERDAFTAR!`)
  console.log(`   Tx Hash: ${txRegister.hash}`)
}

// --- EKSEKUSI ---
// Ganti 'namadomainbaru' dengan nama yang Anda inginkan
const newLabel = 'patnloikkr'
registerDomain(newLabel).catch(err => {
  console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥')
  console.error(`   - Pesan: ${err.reason || err.message}`)
})
