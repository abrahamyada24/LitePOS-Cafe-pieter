# Entity Relationship Diagram (ERD) Android POS

Berikut adalah Entity Relationship Diagram (ERD) dari sistem Android POS yang diambil berdasarkan struktur database pada file `schema.prisma`. Anda dapat menggunakan diagram ini untuk keperluan presentasi.

```mermaid
erDiagram
    User ||--o{ Transaction : "melakukan"
    User ||--o{ SavedTransaction : "menyimpan"
    Category ||--o{ Product : "memiliki"
    Product ||--o{ TransactionItem : "dibeli_dalam"
    Product ||--o{ StockMovement : "memiliki_pergerakan"
    Product ||--o{ StockReceiptItem : "diterima_dalam"
    Product ||--o{ ProductAddon : "memiliki_addon"
    Product ||--o{ PackageItem : "termasuk_dalam"
    Customer ||--o{ Transaction : "melakukan"
    Transaction ||--o{ TransactionItem : "berisi"
    Transaction ||--o{ Payment : "memiliki_pembayaran"
    StockReceipt ||--o{ StockReceiptItem : "berisi"
    Package ||--o{ PackageItem : "berisi"

    User {
        Int id PK
        String name
        String email
        String password
        Role role
        Boolean isActive
    }

    Category {
        Int id PK
        String name
        String displayType
    }

    Product {
        Int id PK
        Int categoryId FK
        String sku
        String name
        Decimal price
        Decimal costPrice
        Int stock
        Boolean isActive
    }

    Customer {
        Int id PK
        String memberId
        String name
        String phone
        Int points
    }

    Transaction {
        Int id PK
        Int userId FK
        Int customerId FK
        String invoiceNumber
        Decimal subTotal
        Decimal grandTotal
        TransactionStatus status
        OrderType orderType
    }

    TransactionItem {
        Int id PK
        Int transactionId FK
        Int productId FK
        Int qty
        Decimal price
    }

    Payment {
        Int id PK
        Int transactionId FK
        PaymentType paymentType
        Decimal amount
        String paymentStatus
    }

    StockMovement {
        Int id PK
        Int productId FK
        StockMovementType type
        Int qty
        StockMovementSource source
    }

    StockReceipt {
        String id PK
        DateTime receivedAt
        String notes
        String createdBy
    }

    StockReceiptItem {
        Int id PK
        String receiptId FK
        Int productId FK
        Int quantityAdded
    }

    SavedTransaction {
        String id PK
        Int userId FK
        String name
        String cartData
    }

    Shift {
        String id PK
        Int userId
        String userName
        ShiftStatus status
    }

    Expense {
        Int id PK
        String description
        Decimal amount
        String category
    }

    DineTable {
        Int id PK
        String number
        String name
        Int capacity
        String status
    }

    Package {
        Int id PK
        String name
        Decimal price
        Boolean isActive
    }

    PackageItem {
        Int id PK
        Int packageId FK
        Int productId FK
        Int qty
    }

    ProductAddon {
        Int id PK
        Int productId FK
        String name
        Decimal price
    }

    StoreSetting {
        Int id PK
        String storeName
        Boolean enableCash
        Boolean enableQris
        Decimal taxRate
    }

    LoyaltyConfig {
        Int id PK
        Decimal pointMultiplier
        Decimal pointValue
        Boolean isActive
    }

    Supplier {
        Int id PK
        String name
        String phone
    }
```

### Penjelasan Singkat Struktur
1. **Core / Transaksi**: Pusat dari sistem adalah entitas `Transaction` yang terhubung dengan `User` (kasir), `Customer` (pembeli), `TransactionItem` (barang yang dibeli), dan `Payment` (metode pembayaran).
2. **Katalog Produk**: Produk (`Product`) berada di dalam kategori (`Category`) dan memiliki ekstensi seperti `ProductAddon` atau digabung menjadi paket (`Package` & `PackageItem`).
3. **Manajemen Stok**: Pergerakan stok dilacak melalui `StockMovement` dan penerimaan stok baru tercatat di `StockReceipt` serta `StockReceiptItem`.
4. **Operasional & Setting**: Terdapat entitas pendukung operasional kasir seperti `Shift`, pencatatan pengeluaran di `Expense`, manajemen meja pada `DineTable`, dan pengaturan global toko seperti `StoreSetting` dan `LoyaltyConfig`.
