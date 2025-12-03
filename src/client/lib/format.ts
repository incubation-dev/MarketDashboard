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
  return `${currencyFormatter.format(value)} 億円`
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
