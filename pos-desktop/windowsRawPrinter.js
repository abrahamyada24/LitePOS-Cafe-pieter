const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const MAX_RAW_JOB_BYTES = 2 * 1024 * 1024;
const POWERSHELL_OUTPUT_LIMIT = 64 * 1024;

const escapePowerShellLiteral = (value) => String(value).replace(/'/g, "''");

const runPowerShell = (script) => new Promise((resolve, reject) => {
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { shell: false, windowsHide: true },
  );
  let stdout = '';
  let stderr = '';
  let settled = false;

  const finish = (callback) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    callback();
  };

  const timeout = setTimeout(() => {
    child.kill();
    finish(() => reject(new Error('Windows Print Spooler tidak merespons dalam 30 detik.')));
  }, 30_000);

  child.stdout.on('data', (chunk) => {
    if (stdout.length < POWERSHELL_OUTPUT_LIMIT) stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    if (stderr.length < POWERSHELL_OUTPUT_LIMIT) stderr += chunk.toString();
  });
  child.on('error', (error) => {
    finish(() => reject(error));
  });
  child.on('close', (exitCode) => {
    finish(() => {
      if (exitCode === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Windows Print Spooler berhenti dengan kode ${exitCode}.`));
      }
    });
  });
});

const RAW_PRINTER_NATIVE_TYPE = String.raw`
using System;
using System.Runtime.InteropServices;

public static class LitePosRawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOC_INFO_1
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string printerName, out IntPtr printerHandle, IntPtr printerDefaults);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(IntPtr printerHandle, int level, [In] DOC_INFO_1 documentInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr printerHandle, IntPtr bytes, int byteCount, out int bytesWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr printerHandle);
}`;

const buildRawPrintScript = (printerName, temporaryFile) => {
  const safePrinterName = escapePowerShellLiteral(printerName);
  const safeTemporaryFile = escapePowerShellLiteral(temporaryFile);
  const safeNativeType = RAW_PRINTER_NATIVE_TYPE.replace(/'@/g, "' + '@");

  return `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${safeNativeType}
'@

$printerName = '${safePrinterName}'
$filePath = '${safeTemporaryFile}'
$printerHandle = [IntPtr]::Zero
$memory = [IntPtr]::Zero
$documentStarted = $false
$pageStarted = $false
$result = $null

function Get-Win32Message {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  return "$code - $([ComponentModel.Win32Exception]::new($code).Message)"
}

try {
  $bytes = [IO.File]::ReadAllBytes($filePath)
  if (-not [LitePosRawPrinter]::OpenPrinter($printerName, [ref]$printerHandle, [IntPtr]::Zero)) {
    throw "Printer '$printerName' tidak dapat dibuka: $(Get-Win32Message)"
  }

  $documentInfo = New-Object LitePosRawPrinter+DOC_INFO_1
  $documentInfo.pDocName = 'LitePOS ESC-POS Receipt'
  $documentInfo.pDataType = 'RAW'
  $jobId = [LitePosRawPrinter]::StartDocPrinter($printerHandle, 1, $documentInfo)
  if ($jobId -le 0) { throw "Job RAW tidak dapat dimulai: $(Get-Win32Message)" }
  $documentStarted = $true

  if (-not [LitePosRawPrinter]::StartPagePrinter($printerHandle)) {
    throw "Halaman RAW tidak dapat dimulai: $(Get-Win32Message)"
  }
  $pageStarted = $true

  $memory = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $memory, $bytes.Length)
  $bytesWritten = 0
  if (-not [LitePosRawPrinter]::WritePrinter($printerHandle, $memory, $bytes.Length, [ref]$bytesWritten)) {
    throw "Data ESC/POS tidak dapat ditulis: $(Get-Win32Message)"
  }
  if ($bytesWritten -ne $bytes.Length) {
    throw "Data ESC/POS tidak lengkap: $bytesWritten dari $($bytes.Length) byte."
  }

  if (-not [LitePosRawPrinter]::EndPagePrinter($printerHandle)) {
    throw "Halaman RAW tidak dapat diselesaikan: $(Get-Win32Message)"
  }
  $pageStarted = $false
  if (-not [LitePosRawPrinter]::EndDocPrinter($printerHandle)) {
    throw "Job RAW tidak dapat diselesaikan: $(Get-Win32Message)"
  }
  $documentStarted = $false
  $result = [pscustomobject]@{ jobId = $jobId; bytesWritten = $bytesWritten }
}
finally {
  if ($memory -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($memory) }
  if ($pageStarted) { [void][LitePosRawPrinter]::EndPagePrinter($printerHandle) }
  if ($documentStarted) { [void][LitePosRawPrinter]::EndDocPrinter($printerHandle) }
  if ($printerHandle -ne [IntPtr]::Zero) { [void][LitePosRawPrinter]::ClosePrinter($printerHandle) }
}

$result | ConvertTo-Json -Compress
`;
};

const getWindowsPrinterDetails = async () => {
  if (process.platform !== 'win32') return [];
  const output = await runPowerShell(`
$ErrorActionPreference = 'Stop'
$printers = @(Get-CimInstance -ClassName Win32_Printer | Select-Object Name, DriverName, PortName, Default, WorkOffline, PrinterStatus)
ConvertTo-Json -InputObject $printers -Compress
`);
  if (!output) return [];

  const parsed = JSON.parse(output);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((printer) => ({
    name: String(printer.Name || ''),
    driverName: String(printer.DriverName || ''),
    portName: String(printer.PortName || ''),
    isDefault: Boolean(printer.Default),
    workOffline: Boolean(printer.WorkOffline),
    printerStatus: Number(printer.PrinterStatus || 0),
  })).filter((printer) => printer.name);
};

const sendRawCommand = async (printerName, command) => {
  if (process.platform !== 'win32') throw new Error('Cetak ESC/POS desktop hanya tersedia di Windows.');
  if (!printerName) throw new Error('Nama printer belum dipilih.');
  if (!Buffer.isBuffer(command) || command.length === 0) throw new Error('Data cetak masih kosong.');
  if (command.length > MAX_RAW_JOB_BYTES) throw new Error('Data cetak terlalu besar.');

  const temporaryFile = path.join(os.tmpdir(), `litepos-print-${process.pid}-${randomUUID()}.bin`);
  await fs.writeFile(temporaryFile, command, { flag: 'wx' });

  try {
    const output = await runPowerShell(buildRawPrintScript(printerName, temporaryFile));
    const result = JSON.parse(output || '{}');
    if (Number(result.bytesWritten) !== command.length) {
      throw new Error('Windows tidak mengonfirmasi seluruh data ESC/POS yang dikirim.');
    }
    return {
      jobId: Number(result.jobId || 0),
      bytesWritten: Number(result.bytesWritten || 0),
    };
  } finally {
    await fs.unlink(temporaryFile).catch(() => undefined);
  }
};

module.exports = {
  buildRawPrintScript,
  escapePowerShellLiteral,
  getWindowsPrinterDetails,
  sendRawCommand,
};
