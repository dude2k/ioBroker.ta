const STATUS_TEXTS = new Map<number, string>([
	[0, "OK"],
	[1, "NODE ERROR"],
	[2, "FAIL"],
	[3, "SYNTAX ERROR"],
	[4, "TOO MANY REQUESTS"],
	[5, "DEVICE NOT SUPPORTED"],
	[6, "TOO FEW ARGUMENTS"],
	[7, "CAN BUSY"],
]);

export function getCmiStatusText(statusCode: number): string {
	return STATUS_TEXTS.get(statusCode) ?? "ERROR";
}

export function isBackoffStatus(statusCode: number): boolean {
	return statusCode === 4 || statusCode === 7;
}
