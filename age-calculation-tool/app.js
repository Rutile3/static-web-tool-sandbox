(() => {
    'use strict';

    const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
    const MIN_DATE = { year: 1900, month: 1, day: 1 };
    const MAX_DATE = { year: 9999, month: 12, day: 31 };

    const elements = {
        form: document.getElementById('ageForm'),
        birthDate: document.getElementById('birthDate'),
        birthDateTodayButton: document.getElementById('birthDateTodayButton'),
        targetDate: document.getElementById('targetDate'),
        targetDateTodayButton: document.getElementById('targetDateTodayButton'),
        clearButton: document.getElementById('clearButton'),
        errorArea: document.getElementById('errorArea'),
        emptyState: document.getElementById('emptyState'),
        resultArea: document.getElementById('resultArea'),
        conditionText: document.getElementById('conditionText'),
        fullAgeResult: document.getElementById('fullAgeResult'),
        countedAgeResult: document.getElementById('countedAgeResult'),
        daysSinceBirthResult: document.getElementById('daysSinceBirthResult'),
        daysUntilBirthdayResult: document.getElementById('daysUntilBirthdayResult'),
    };

    document.addEventListener('DOMContentLoaded', initialize);

    function initialize() {
        elements.targetDate.value = getTodayString();
        hideErrors();
        hideResult();

        elements.form.addEventListener('submit', (event) => {
            event.preventDefault();
            calculateAndRender();
        });

        elements.targetDateTodayButton.addEventListener('click', () => {
            elements.targetDate.value = getTodayString();

            if (!elements.resultArea.classList.contains('d-none') && elements.birthDate.value) {
                calculateAndRender();
            }
        });

        elements.birthDateTodayButton.addEventListener('click', () => {
            elements.birthDate.value = getTodayString();

            if (!elements.resultArea.classList.contains('d-none') && elements.targetDate.value) {
                calculateAndRender();
            }
        });

        elements.clearButton.addEventListener('click', clearForm);
    }

    function getTodayString() {
        const today = new Date();
        return toDateInputValue({
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            day: today.getDate(),
        });
    }

    function parseDateInput(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }

        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
            return null;
        }

        const date = {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
        };

        if (!isValidDateParts(date.year, date.month, date.day)) {
            return null;
        }

        return date;
    }

    function isValidDateParts(year, month, day) {
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
            return false;
        }

        if (year < 1 || month < 1 || month > 12 || day < 1) {
            return false;
        }

        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return day <= lastDay;
    }

    function isDateWithinSupportedRange(date) {
        return compareDate(date, MIN_DATE) >= 0 && compareDate(date, MAX_DATE) <= 0;
    }

    function validateInput(birthDateValue, targetDateValue) {
        const errors = [];
        const birthDate = parseDateInput(birthDateValue);
        const targetDate = parseDateInput(targetDateValue);
        
        let canCompareBirthDate = false;
        let canCompareTargetDate = false;

        if (!birthDateValue) {
            errors.push('生年月日を入力してください。');
        } else if (!birthDate) {
            errors.push('正しい生年月日を入力してください。');
        } else if (!isDateWithinSupportedRange(birthDate)) {
            errors.push('生年月日は1900-01-01から9999-12-31までの日付を入力してください。');
        } else {
            canCompareBirthDate = true;
        }

        if (!targetDateValue) {
            errors.push('基準日を入力してください。');
        } else if (!targetDate) {
            errors.push('正しい基準日を入力してください。');
        } else if (!isDateWithinSupportedRange(targetDate)) {
            errors.push('基準日は1900-01-01から9999-12-31までの日付を入力してください。');
        } else {
            canCompareTargetDate = true;
        }

        if (canCompareBirthDate && canCompareTargetDate && compareDate(birthDate, targetDate) > 0) {
            errors.push('生年月日は基準日以前の日付を入力してください。');
        }

        return {
            errors,
            birthDate,
            targetDate,
        };
    }

    function calculateAndRender() {
        const validation = validateInput(elements.birthDate.value, elements.targetDate.value);

        if (validation.errors.length > 0) {
            renderErrors(validation.errors);
            hideResult();
            return;
        }

        hideErrors();
        const ageInfo = calculateAgeInfo(validation.birthDate, validation.targetDate);
        renderResult(ageInfo);
    }

    function calculateAgeInfo(birthDate, targetDate) {
        const fullAge = calculateFullAge(birthDate, targetDate);
        const countedAge = calculateCountedAge(birthDate, targetDate);
        const daysSinceBirth = calculateDaysBetween(birthDate, targetDate);

        const birthdayThisYear = getBirthdayInYear(birthDate, targetDate.year);
        const isBirthday = compareDate(targetDate, birthdayThisYear) === 0;
        const nextBirthday = compareDate(targetDate, birthdayThisYear) <= 0
            ? birthdayThisYear
            : getBirthdayInYear(birthDate, targetDate.year + 1);

        return {
            fullAge,
            countedAge,
            daysSinceBirth,
            daysUntilNextBirthday: calculateDaysBetween(targetDate, nextBirthday),
            isBirthday,
            birthDateText: formatJapaneseDate(birthDate),
            targetDateText: formatJapaneseDate(targetDate),
        };
    }

    function calculateFullAge(birthDate, targetDate) {
        let fullAge = targetDate.year - birthDate.year;
        const birthdayThisYear = getBirthdayInYear(birthDate, targetDate.year);

        if (compareDate(targetDate, birthdayThisYear) < 0) {
            fullAge -= 1;
        }

        return fullAge;
    }

    function calculateCountedAge(birthDate, targetDate) {
        return targetDate.year - birthDate.year + 1;
    }

    function calculateDaysBetween(fromDate, toDate) {
        const fromUtc = Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day);
        const toUtc = Date.UTC(toDate.year, toDate.month - 1, toDate.day);

        return Math.round((toUtc - fromUtc) / MILLIS_PER_DAY);
    }

    function getBirthdayInYear(birthDate, year) {
        // 2月29日生まれの場合、うるう年ではない年は2月28日を誕生日相当日として扱う。
        if (birthDate.month === 2 && birthDate.day === 29 && !isLeapYear(year)) {
            return { year, month: 2, day: 28 };
        }

        return { year, month: birthDate.month, day: birthDate.day };
    }

    function isLeapYear(year) {
        return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    }

    function compareDate(a, b) {
        if (a.year !== b.year) {
            return a.year - b.year;
        }

        if (a.month !== b.month) {
            return a.month - b.month;
        }

        return a.day - b.day;
    }

    function toDateInputValue(date) {
        return [
            String(date.year).padStart(4, '0'),
            String(date.month).padStart(2, '0'),
            String(date.day).padStart(2, '0'),
        ].join('-');
    }

    function formatJapaneseDate(date) {
        return `${date.year}年${date.month}月${date.day}日`;
    }

    function formatNumber(value) {
        return value.toLocaleString('ja-JP');
    }

    function renderResult(ageInfo) {
        elements.conditionText.textContent =
            `生年月日：${ageInfo.birthDateText} ／ 基準日：${ageInfo.targetDateText}`;

        elements.fullAgeResult.textContent = `${formatNumber(ageInfo.fullAge)}歳`;
        elements.countedAgeResult.textContent = `${formatNumber(ageInfo.countedAge)}歳`;
        elements.daysSinceBirthResult.textContent = `生後${formatNumber(ageInfo.daysSinceBirth)}日`;
        elements.daysUntilBirthdayResult.textContent = ageInfo.isBirthday
            ? '今日が誕生日です'
            : `あと${formatNumber(ageInfo.daysUntilNextBirthday)}日`;

        elements.emptyState.classList.add('d-none');
        elements.resultArea.classList.remove('d-none');
    }

    function renderErrors(errors) {
        const listItems = errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('');
        elements.errorArea.innerHTML = `<ul class="mb-0">${listItems}</ul>`;
        elements.errorArea.classList.remove('d-none');
    }

    function hideErrors() {
        elements.errorArea.textContent = '';
        elements.errorArea.classList.add('d-none');
    }

    function hideResult() {
        elements.resultArea.classList.add('d-none');
        elements.emptyState.classList.remove('d-none');
    }

    function clearForm() {
        elements.birthDate.value = '';
        elements.targetDate.value = '';
        hideErrors();
        hideResult();
        elements.birthDate.focus();
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => {
            const entities = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            };

            return entities[char];
        });
    }

    // 簡易テストやデバッグで使えるよう、計算ロジックのみ公開する。
    window.AgeCalculationTool = {
        parseDateInput,
        validateInput,
        isDateWithinSupportedRange,
        calculateAgeInfo,
        calculateFullAge,
        calculateCountedAge,
        calculateDaysBetween,
        getBirthdayInYear,
        isLeapYear,
    };
})();
