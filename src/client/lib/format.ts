const currencyFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 1
})

const percentFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 1
})

export const formatMarketSize = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '―'
  }
  
  // Value is stored in base unit (e.g., 185000000000 = 1850億円)
  // Auto-scale to appropriate unit
  if (value >= 1_000_000_000_000) {
    // 1 trillion+ (兆円)
    return `${currencyFormatter.format(value / 1_000_000_000_000)}兆円`
  } else if (value >= 100_000_000) {
    // 100 million+ (億円)
    return `${currencyFormatter.format(value / 100_000_000)}億円`
  } else if (value >= 10_000) {
    // 10 thousand+ (万円)
    return `${currencyFormatter.format(value / 10_000)}万円`
  } else {
    // Less than 10 thousand (円)
    return `${currencyFormatter.format(value)}円`
  }
}

export const formatPercent = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '―'
  }
  return `${percentFormatter.format(value)}%`
}

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '―'
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '―'
    }
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return value
  }
}
