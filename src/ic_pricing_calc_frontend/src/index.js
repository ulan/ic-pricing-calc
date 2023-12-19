const SECONDS_PER_DAY = 24 * 60 * 60;
const DAYS_PER_MONTH = 30;
const SDR_TO_USD = 1.34;
const SDR_TO_CYCLES = 1e12;
const GB = 1024 * 1024 * 1024;

window.addEventListener("load", async (event) => {
	let form = document.getElementById("form");
	let inputs = form.getElementsByTagName("input");
	for (let input of inputs) {
		input.addEventListener("input", calculate);
	}
	await fetch_config();
	await calculate();
});

async function fetch_config() {
	let config = await fetch("https://kbncd-2yaaa-aaaag-qctkq-cai.raw.icp0.io/config?version=206a50f01306b398eb7e25988c7925fcd0e2caa4")
	config = await config.json();
	globalThis.ic_config = config;
}

function messaging_cost(input, config, sdr_to_usd, sdr_to_cycles) {
	let fees = config["application:"].fees;

	let num_messages = input.num_active_users * input.num_messages_per_active_user;
	let num_message_bytes = num_messages * input.num_payload_bytes_per_message;

	let num_calls = num_messages * input.num_calls_per_message;
	let num_call_bytes = num_messages * input.num_payload_bytes_per_call;

	let cycles = fees.ingress_byte_reception_fee * num_messages +
		fees.ingress_byte_reception_fee * num_message_bytes + fees.xnet_call_fee *
		num_calls + fees.xnet_byte_transmission_fee * num_call_bytes;
	cycles = cycles * DAYS_PER_MONTH / 13 * input.num_subnet_nodes;
	let usd = cycles * sdr_to_usd / sdr_to_cycles;
	return `$${Math.round(usd * 100) / 100} (= ${cycles.toExponential(2)} cycles)`;
}

function http_outcalls_cost(input, config, sdr_to_usd, sdr_to_cycles) {
	let fees = config["application:"].fees;

	let num_http_outcalls = input.num_http_outcalls;

	let num_request_bytes_per_http_outcall = input.num_request_bytes_per_http_outcall;
	let num_response_bytes_per_http_outcall = input.num_response_bytes_per_http_outcall;

	let cycles = (
		fees.http_request_linear_baseline_fee +
		fees.http_request_quadratic_baseline_fee * input.num_subnet_nodes +
		fees.http_request_per_byte_fee * num_request_bytes_per_http_outcall +
		fees.http_response_per_byte_fee * num_response_bytes_per_http_outcall
	) * num_http_outcalls * input.num_subnet_nodes;

	cycles = cycles * DAYS_PER_MONTH;
	let usd = cycles * sdr_to_usd / sdr_to_cycles;
	return `$${Math.round(usd * 100) / 100} (= ${cycles.toExponential(2)} cycles)`;
}

function execution_cost(input, config, sdr_to_usd, sdr_to_cycles) {
	let fees = config["application:"].fees;

	let num_messages = input.num_active_users * input.num_messages_per_active_user;
	let num_message_instructions = num_messages * input.num_instructions_per_message;

	let num_calls = num_messages * input.num_calls_per_message;
	let num_call_instructions = num_calls * input.num_instructions_per_call;

	let num_tasks = input.num_tasks;
	let num_task_instructions = num_tasks * input.num_instructions_per_task;

	let num_updates = num_messages + num_calls + num_tasks;
	let num_instructions = num_message_instructions + num_task_instructions + num_call_instructions;

	let cycles = fees.update_message_execution_fee * num_updates +
		fees.ten_update_instructions_execution_fee * num_instructions / 10;

	cycles = cycles * DAYS_PER_MONTH / 13 * input.num_subnet_nodes;
	let usd = cycles * sdr_to_usd / sdr_to_cycles;
	return `$${Math.round(usd * 100) / 100} (= ${cycles.toExponential(2)} cycles)`;
}

function storage_cost(input, config, sdr_to_usd, sdr_to_cycles) {
	let fees = config["application:"].fees;
	let user_storage = input.num_total_users * input.num_storage_bytes_per_user;
	let other_storage = input.num_storage_bytes;
	let storage = user_storage + other_storage;
	let cycles = fees.gib_storage_per_second_fee * storage / GB * DAYS_PER_MONTH
		* SECONDS_PER_DAY / 13 * input.num_subnet_nodes;
	let usd = cycles * sdr_to_usd / sdr_to_cycles;
	return `$${Math.round(usd * 100) / 100} (= ${cycles.toExponential(2)} cycles)`;
}

async function calculate() {
	clear();
	if (!ic_config) {
		await fetch_config();
	}
	let input = parse();
	let result = [
		"<div>",
		"<table>",
		"<thead><tr><th>Category</th><th>Cost per month, USD</th></tr></thead>",
		"<tbody>",
		`<tr><td>Storage</td><td>${storage_cost(input, ic_config, SDR_TO_USD, SDR_TO_CYCLES)}</td></tr>`,
		`<tr><td>Execution</td><td>${execution_cost(input, ic_config, SDR_TO_USD, SDR_TO_CYCLES)}</td></tr>`,
		`<tr><td>Messaging</td><td>${messaging_cost(input, ic_config, SDR_TO_USD, SDR_TO_CYCLES)}</td></tr>`,
		`<tr><td>HTTP outcalls</td><td>${http_outcalls_cost(input, ic_config, SDR_TO_USD, SDR_TO_CYCLES)}</td></tr>`,
		"</tbody>",
		"</table>",
		"</div>"
	];
	render(result.join("\n"));
}

function clear() {
	let output = document.getElementById("output");
	output.innerHTML = "";
}

function render(text) {
	let output = document.getElementById("output");
	output.innerHTML = output.innerHTML + text;
}

function parse() {
	let form = document.getElementById("form");
	let inputs = form.getElementsByTagName("input");
	let result = {};
	for (let input of inputs) {
		result[input.id] = parseFloat(input.value);
	}
	return result;
}
