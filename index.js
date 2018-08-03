const jsJoda = require('js-joda').use(require('js-joda-timezone'))
const { ZonedDateTime, ChronoField, ChronoUnit, nativeJs, convert } = jsJoda;

const MILI = 'milliseconds',
  SECONDS = 'seconds',
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  DECADE = 'decade',
  CENTURY = 'century'

const chronoUnitMap = {
  [MILI]: ChronoUnit.MILLIS,
  [SECONDS]: ChronoUnit.SECONDS,
  [MINUTES]: ChronoUnit.MINUTES,
  [HOURS]: ChronoUnit.HOURS,
  [DAY]: ChronoUnit.DAYS,
  [WEEK]: ChronoUnit.WEEKS,
  [MONTH]: ChronoUnit.MONTHS,
  [YEAR]: ChronoUnit.YEARS,
  [DECADE]: ChronoUnit.DECADES,
  [CENTURY]: ChronoUnit.CENTURIES,
}

const parseToZDT = (date) => {
  if (date.constructor.name === 'ZonedDateTime') {
    return date;
  }

  // nativeJs will work on moment + Date
  return ZonedDateTime.from(nativeJs(date));
}

const lib = module.exports = {
  // Accessors:
  milliseconds: createAccessor(
    zdt => zdt.get(ChronoField.MILLI_OF_SECOND),
    (zdt, val) => zdt.with(ChronoField.MILLI_OF_SECOND, val)
  ),
  seconds: createAccessor(
    zdt => zdt.second(),
    (zdt, val) => zdt.withSecond(val)
  ),
  minutes: createAccessor(
    zdt => zdt.minute(),
    (zdt, val) => zdt.withMinute(val)
  ),
  // DST
  hours: createAccessor(
    zdt => zdt.hour(),
    (zdt, val) => zdt.withHour(val)
  ),
  day: createAccessor(
    zdt => zdt.dayOfWeek().value() % 7, // joda's week starts on monday (with index 1)
    (zdt, val) => zdt.with(ChronoField.DAY_OF_WEEK, (val + 6) % 7 + 1)
  ),
  // REVISIT - not sure how this is different from above
  weekday: (zdt, val, firstDay) => {
    const weekday = (zdt.dayOfWeek().value() + 7 - (firstDay || 0)) % 7
    return val === undefined
      ? weekday
      : zdt.plus(val - weekday, ChronoUnit.DAYS)
  },
  date: createAccessor(
    zdt => zdt.dayOfMonth(),
    (zdt, val) => zdt.withDayOfMonth(val)
  ),
  month: createAccessor(
    zdt => zdt.monthValue() -1,
    (zdt, val) => {
      return zdt.withMonth(val + 1) // joda counts months starting from 1
    }
  ),
  year: createAccessor(
    zdt => zdt.year(),
    (zdt, val) => zdt.withYear(val)
  ),
  nativeTime: (zdt) => {
    const milli = zdt.get(ChronoField.MILLI_OF_SECOND)
    const seconds = zdt.get(ChronoField.INSTANT_SECONDS)
    return seconds * 1000 + milli
  },

  // Maths
  add: (date, value, unit) => {
    const zdt = parseToZDT(date)
    const chronoUnit = chronoUnitMap[unit]
    if (chronoUnit === undefined) {
      throw new TypeError(`Invalid units when adding: "${unit}"`)
    }
    return zdt.plus(value, chronoUnit)
  },
  subtract: (date, value, unit) => {
    const zdt = parseToZDT(date)
    const chronoUnit = chronoUnitMap[unit]
    if (chronoUnit === undefined) {
      throw new TypeError(`Invalid units when adding: "${unit}"`)
    }
    return zdt.minus(value, chronoUnit)
  },
  eq: createComparer((a, b) => a.toLocalDateTime().equals(b.toLocalDateTime())),
  neq: createComparer((a, b) => !a.equals(b)),
  gte: createComparer((a, b) => a.equals(b) || a.isAfter(b)),
  gt: createComparer((a, b) => a.isAfter(b)),
  lte: createComparer((a, b) => a.equals(b) || a.isBefore(b)),
  lt: createComparer((a, b) => a.isBefore(b)),
  min: function() {
    let min
    Array.prototype.slice.call(arguments).forEach(date => {
      const zdt = parseToZDT(date)
      if (!min || zdt.isBefore(min)) {
        min = zdt
      }
    })
    return min
  },
  max: function() {
    let max
    Array.prototype.slice.call(arguments).forEach(date => {
      const zdt = parseToZDT(date)
      if (!max || zdt.isAfter(max)) {
        max = zdt
      }
    })
    return max
  },
  diff: function(date1, date2, unit, asFloat) {
    let dividend, divisor, result
    const zdt1 = parseToZDT(date1)
    const zdt2 = parseToZDT(date2)

    // pre-work
    switch (unit) {
      case MILI:
      case SECONDS:
      case MINUTES:
      case HOURS:
      case DAY:
      case WEEK:
        dividend = lib.nativeTime(zdt2) - lib.nativeTime(zdt1)
        break
      case MONTH:
      case YEAR:
      case DECADE:
      case CENTURY:
        dividend =
          (lib.year(zdt2) - lib.year(zdt1)) * 12 +
          lib.month(zdt2) -
          lib.month(zdt1)
        break
      default:
        throw new TypeError(`Invalid units for diff: "${unit}"`)
    }

    // post-work
    switch (unit) {
      case MILI:
        divisor = 1
        break
      case SECONDS:
        divisor = 1000
        break
      case MINUTES:
        divisor = 1000 * 60
        break
      case HOURS:
        divisor = 1000 * 60 * 60
        break
      case DAY:
        divisor = 1000 * 60 * 60 * 24
        break
      case WEEK:
        divisor = 1000 * 60 * 60 * 24 * 7
        break
      case MONTH:
        divisor = 1
        break
      case YEAR:
        divisor = 12
        break
      case DECADE:
        divisor = 120
        break
      case CENTURY:
        divisor = 1200
        break
      default:
        throw new TypeError(`Invalid units for diff: "${unit}"`)
    }

    result = dividend / divisor

    return asFloat ? result : Math.round(result)
  }
}

// Utility funcs
module.exports.inRange = (day, min, max, unit) => {
  unit = unit || DAY

  return (
    (!min || lib.gte(day, min, unit)) && (!max || lib.lte(day, max, unit))
  )
}

module.exports.startOf = (date, unit, firstOfWeek) => {
  let result = parseToZDT(date)

  // do some pre-work
  switch (unit) {
    case CENTURY:
    case DECADE:
    case YEAR:
      result = lib.month(result, 0)
    case MONTH:
      result = lib.date(result, 1)
    case WEEK:
    case DAY:
      result = result
        .toLocalDate()
        .atStartOfDay()
        .atZone(result.zone())
    case HOURS:
      result = lib.minutes(result, 0)
    case MINUTES:
      result = lib.seconds(result, 0)
    case SECONDS:
      result = lib.milliseconds(result, 0)
  }

  // additional post-work
  if (unit === DECADE) {
    result = lib.subtract(result, lib.year(result) % 10, YEAR)
  }

  if (unit === CENTURY) {
    result = lib.subtract(result, lib.year(result) % 100, YEAR)
  }

  if (unit === WEEK) {
    result = lib.weekday(result, 0, firstOfWeek)
  }

  return result
}

// this is confusing, needs specs
module.exports.endOf = (date, unit, firstOfWeek) => {
  let result = parseToZDT(date)
  result = lib.startOf(result, unit, firstOfWeek)
  result = lib.add(result, 1, unit)
  result = lib.subtract(result, 1, MILI)
  return result
}

function createComparer(comparer) {
  return function(a, b, unit) {
    const zdtA = parseToZDT(a)
    const zdtB = parseToZDT(b)
    return comparer(lib.startOf(zdtA, unit), lib.startOf(zdtB, unit))
  }
}

function createAccessor(getter, setter) {
  return function(date, setValue) {
    const zdt = parseToZDT(date);
    if (setValue || setValue === 0) {
      return setter(zdt, setValue)
    }

    return getter(zdt)
  }
}
