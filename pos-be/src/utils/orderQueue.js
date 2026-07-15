const getJakartaDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const formatQueueLabel = (queueNumber) => `A-${String(queueNumber).padStart(3, '0')}`;

const getNextQueueNumber = async (tx, queueDate) => {
    await tx.$executeRaw`
        INSERT INTO order_queue_counters (queue_date, last_number, created_at, updated_at)
        VALUES (${queueDate}, LAST_INSERT_ID(1), NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
            last_number = LAST_INSERT_ID(last_number + 1),
            updated_at = NOW(3)
    `;
    const rows = await tx.$queryRaw`SELECT LAST_INSERT_ID() AS queueNumber`;
    return Number(rows[0].queueNumber);
};

const reserveQueue = async (tx) => {
    const queueDate = getJakartaDateKey();
    const queueNumber = await getNextQueueNumber(tx, queueDate);
    return { queueDate, queueNumber, queueLabel: formatQueueLabel(queueNumber) };
};

module.exports = { getJakartaDateKey, formatQueueLabel, getNextQueueNumber, reserveQueue };
