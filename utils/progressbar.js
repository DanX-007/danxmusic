function progressBar(current, total, length) {
    const progress = Math.round((current / total) * length);
    const emptyProgress = length - progress;

    const progressText = '▇'.repeat(progress);
    const emptyProgressText = '—'.repeat(emptyProgress);

    return progress === length ? '[▇▇▇▇▇▇▇▇▇▇▇]' : `[${progressText}${emptyProgressText}]`;
}

module.exports = { progressBar };