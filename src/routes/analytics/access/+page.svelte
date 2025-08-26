<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatBytes } from '$lib/utils';
	import LogChart from '$lib/components/LogChart.svelte';
	import AnalyticsWorker from '$lib/workers/analytics.worker?worker';
	import { LucideLoader, LucideLock, LucideServer, LucideTerminal, LucideUser, LucideGlobe, LucideFile, LucideArchive, LucideCalendar, LucideRefreshCw, LucideArrowRight, LucideInfo, LucideKey, LucideAlertCircle } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { data, form }: { data: any; form: ActionData } = $props();
	
	let isLoading = $state(false);
	let showPrivateKey = $state(false);
	let usePrivateKey = $state(false);
	let selectedLogFiles = $state<string[]>([]);
	let searchQuery = $state('');
	let selectedMethods = $state<string[]>([]);
	let selectedStatusTypes = $state<string[]>([]);

	let statusDistributionData = $state(null);
	let topIpsData = $state(null);

	interface LogEntry {
		id: string | number;
		timestamp: Date;
		statusType: 'success' | 'redirect' | 'error' | string;
		status: number;
		method: string;
		path: string;
		ip: string;
		referrer: string;
		userAgent: string;
		size: number;
		sourceFile?: string;
		rawLog: string;
	}

	const allLogs: LogEntry[] = $derived(form?.success && form.entries ? JSON.parse(form.entries, (key, value) => {
		if (key === 'timestamp') return new Date(value);
		return value;
	}) : []);

	const availableLogFiles = $derived(form?.logFiles || []);

	const availableMethods: string[] = $derived([...new Set(allLogs.map((e: LogEntry) => e.method))]);
	const availableStatusTypes = ['success', 'redirect', 'error'];

	const filteredLogEntries: LogEntry[] = $derived(allLogs.filter((entry: LogEntry) => {
		const fileMatch = selectedLogFiles.length === 0 || (!!entry.sourceFile && selectedLogFiles.includes(entry.sourceFile));
		const methodMatch = selectedMethods.length === 0 || selectedMethods.includes(entry.method);
		const statusMatch = selectedStatusTypes.length === 0 || selectedStatusTypes.includes(entry.statusType);

		const query = searchQuery.toLowerCase();
		const searchMatch = query === '' ||
			entry.path.toLowerCase().includes(query) ||
			entry.ip.toLowerCase().includes(query) ||
			(entry.referrer || '').toLowerCase().includes(query) ||
			entry.userAgent.toLowerCase().includes(query);

		return fileMatch && methodMatch && statusMatch && searchMatch;
	}));

	$effect(() => {
		if (filteredLogEntries.length > 0) {
			const worker = new AnalyticsWorker();

			worker.onmessage = (event: MessageEvent) => {
				statusDistributionData = event.data.statusDistributionData;
				topIpsData = event.data.topIpsData;
				worker.terminate();
			};

			worker.postMessage(filteredLogEntries);

			return () => {
				worker.terminate();
			};
		} else {
			statusDistributionData = null;
			topIpsData = null;
		}
	});

	function toggleLogFileSelection(fileName: string) {
		const index = selectedLogFiles.indexOf(fileName);
		if (index > -1) {
			selectedLogFiles.splice(index, 1);
		} else {
			selectedLogFiles.push(fileName);
		}
	}

	function selectAllLogFiles() {
		selectedLogFiles = availableLogFiles
			.map((file) => file.name)
			.filter((n): n is string => Boolean(n));
	}

	function deselectAllLogFiles() {
		selectedLogFiles = [];
	}

	function toggleArrayItem<T>(arr: T[], item: T) {
		const newArr = [...arr];
		const index = newArr.indexOf(item);
		if (index > -1) {
			newArr.splice(index, 1);
		} else {
			newArr.push(item);
		}
		return newArr;
	}

	function toggleMethodSelection(method: string) {
		selectedMethods = toggleArrayItem(selectedMethods, method);
	}

	function toggleStatusSelection(status: string) {
		selectedStatusTypes = toggleArrayItem(selectedStatusTypes, status);
	}

</script>

<svelte:head>
	<title>Access Logs | WebTrace Analytics</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="text-2xl font-bold mb-6">Access Logs</h1>
	
	<div class="grid grid-cols-1 gap-6">
		<!-- SSH Credentials Form -->
		<div class="card bg-base-100 shadow-md">
			<div class="card-body">
				<h2 class="card-title">
					<LucideServer class="w-5 h-5" />
					SSH Connection
				</h2>
				
				<form method="POST" use:enhance={() => {
					isLoading = true;
					
					return async ({ result, update }) => {
						isLoading = false;
						await update();
					};
				}}>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div class="form-control">
							<label for="host" class="label">
								<span class="label-text flex items-center gap-2">
									<LucideGlobe class="w-4 h-4" />
									SSH Host
								</span>
							</label>
							<input 
								type="text" 
								name="host" 
								id="host" 
								placeholder="example.com" 
								class="input input-bordered w-full"
							/>
						</div>
						
						<div class="form-control">
							<label for="port" class="label">
								<span class="label-text">SSH Port</span>
							</label>
							<input 
								type="number" 
								name="port" 
								id="port" 
								placeholder="22" 
								class="input input-bordered w-full" 
								value="22"
							/>
						</div>
						
						<div class="form-control">
							<label for="username" class="label">
								<span class="label-text flex items-center gap-2">
									<LucideUser class="w-4 h-4" />
									Username
								</span>
							</label>
							<input 
								type="text" 
								name="username" 
								id="username" 
								placeholder="username" 
								class="input input-bordered w-full" 
							/>
						</div>
						
						{#if !usePrivateKey}
							<div class="form-control">
								<label for="password" class="label">
									<span class="label-text flex items-center gap-2">
										<LucideLock class="w-4 h-4" />
										Password
									</span>
								</label>
								<input 
									type="password" 
									name="password" 
									id="password" 
									placeholder="••••••••" 
									class="input input-bordered w-full" 
								/>
							</div>
						{:else}
							<div class="form-control">
								<label for="privateKey" class="label">
									<span class="label-text flex items-center gap-2">
										<LucideKey class="w-4 h-4" />
										Private Key
										<button 
											type="button" 
											class="btn btn-xs" 
											onclick={() => showPrivateKey = !showPrivateKey}
										>
											{showPrivateKey ? 'Hide' : 'Show'}
										</button>
									</span>
								</label>
								<textarea 
									name="privateKey" 
									id="privateKey" 
									placeholder="-----BEGIN RSA PRIVATE KEY-----" 
									class="textarea textarea-bordered w-full h-24" 
									style="font-family: monospace;"
								></textarea>
							</div>
						{/if}
					</div>
					
					<div class="flex justify-between items-center">
						<label class="label cursor-pointer">
							<span class="label-text mr-2">Use Private Key</span> 
							<input type="checkbox" class="toggle toggle-sm" bind:checked={usePrivateKey} />
						</label>
						
						{#if import.meta.env.DEV}
							<button 
								type="button"
								class="btn btn-sm btn-outline"
								onclick={() => {
									// Submit form with dev credentials
									document.querySelector('form')?.requestSubmit();
								}}
							>
								Use Dev Credentials
							</button>
						{/if}
						
						<button type="submit" class="btn btn-primary" disabled={isLoading}>
							{#if isLoading}
								<LucideLoader class="w-4 h-4 animate-spin" />
								Connecting...
							{:else}
								Connect & Fetch Logs
							{/if}
						</button>
					</div>
					
					{#if form?.error}
						<div class="alert alert-error mt-4">
							<LucideAlertCircle class="w-5 h-5" />
							{form.error}
						</div>
					{/if}
				</form>
			</div>
		</div>
		
		<!-- Charts -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
			<div class="bg-base-100 rounded-box shadow p-4 h-96">
				{#if statusDistributionData}
					<LogChart type="pie" data={JSON.parse(JSON.stringify(statusDistributionData))} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Status Code Distribution' } } }} />
				{:else}
					<div class="skeleton w-full h-full"></div>
				{/if}
			</div>
			<div class="bg-base-100 rounded-box shadow p-4 h-96">
				{#if topIpsData}
					<LogChart type="bar" data={JSON.parse(JSON.stringify(topIpsData))} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 IP Addresses' } } }} />
				{:else}
					<div class="skeleton w-full h-full"></div>
				{/if}
			</div>
		</div>

		<!-- Log Entries Table -->
		<div class="mt-6 bg-base-100 rounded-box shadow">
			<div class="overflow-x-auto">
				<h2 class="card-title p-4 pb-0">
					<LucideTerminal class="w-5 h-5" />
					Access Logs
				</h2>

				{#if isLoading}
					<div class="p-4 flex items-center justify-center h-[70vh]">
						<LucideLoader class="w-8 h-8 animate-spin" />
					</div>
				{:else if form?.success}
					<!-- Filters & Search -->
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-base-200 rounded-lg items-end">
						<div class="form-control lg:col-span-2">
							<label for="search" class="label">
								<span class="label-text">Search</span>
							</label>
							<input 
								type="text" 
								id="search" 
								placeholder="Search by path, IP, referrer, etc." 
								class="input input-bordered w-full"
								bind:value={searchQuery}
							/>
						</div>

						<div class="form-control">
							<div class="label">
								<span class="label-text">Method</span>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each availableMethods as method}
									<button 
										class="btn btn-sm {selectedMethods.includes(method) ? 'btn-primary' : 'btn-outline'}"
										onclick={() => toggleMethodSelection(method)}
									>
										{method}
									</button>
								{/each}
							</div>
						</div>

						<div class="form-control">
							<div class="label">
								<span class="label-text">Status</span>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each availableStatusTypes as status}
									<button 
										class="btn btn-sm capitalize {selectedStatusTypes.includes(status) ? '' : 'btn-outline'} {status === 'success' ? 'btn-success' : status === 'redirect' ? 'btn-warning' : 'btn-error'}"
										onclick={() => toggleStatusSelection(status)}
									>
										{status}
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- File selection UI if multiple log files exist -->
					{#if availableLogFiles.length > 0}
						<div class="mb-4">
							<div class="flex items-center justify-between mb-2">
								<h3 class="text-sm font-semibold">Log Files ({availableLogFiles.length})</h3>
								<div class="flex gap-2">
									<button class="btn btn-xs" onclick={selectAllLogFiles}>Select All</button>
									<button class="btn btn-xs" onclick={deselectAllLogFiles}>Clear</button>
								</div>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each availableLogFiles as file}
									<button 
										class="btn btn-sm {selectedLogFiles.includes(file.name ?? '') ? 'btn-primary' : 'btn-outline'}"
										onclick={() => file.name && toggleLogFileSelection(file.name)}
										disabled={!file.name}
									>
										{#if file.compressed}
											<LucideArchive class="w-4 h-4 mr-1" />
										{:else}
											<LucideFile class="w-4 h-4 mr-1" />
										{/if}
										{file.name}
									</button>
								{/each}
							</div>
						</div>
					{/if}
					
					<div class="bg-base-300 rounded-lg overflow-auto h-[70vh] p-2">
						<!-- Parsed log display as table -->
						{#if filteredLogEntries.length > 0}
							<div class="overflow-x-auto w-full">
								<table class="table table-zebra w-full table-fixed">
									<!-- Table header -->
									<thead>
										<tr>
											<th class="w-12"></th> <!-- For expand button -->
											<th class="w-48">Timestamp</th>
											<th class="w-24">Status</th>
											<th class="w-24">Method</th>
											<th>Path</th>
											<th class="w-32">IP</th>
											<th class="w-24">Size</th>
										</tr>
									</thead>

									<!-- Table body -->
									<tbody>
										{#each filteredLogEntries as entry (entry.id)}
											<tr class="font-mono text-xs">
												<td>
													<label for="log-details-{entry.id}" class="btn btn-xs btn-ghost relative">
														<LucideArrowRight class="w-3 h-3 transition-transform duration-200" />
													</label>
												</td>
												<td>{entry.timestamp.toLocaleString()}</td>
												<td>
													<span class="badge
														{entry.statusType === 'success' ? 'badge-success' : ''}
														{entry.statusType === 'redirect' ? 'badge-warning' : ''}
														{entry.statusType === 'error' ? 'badge-error' : ''}
													">
														{entry.status}
													</span>
												</td>
												<td>{entry.method}</td>
												<td class="break-all">{entry.path}</td>
												<td>{entry.ip}</td>
												<td>{formatBytes(entry.size)}</td>
											</tr>
											<!-- Expandable details row -->
											<tr class="font-mono text-xs">
												<td colspan="7" class="p-0">
													<input type="checkbox" id="log-details-{entry.id}" class="peer sr-only" />
													<div class="hidden peer-checked:grid p-4 bg-base-200 gap-4">
														<div class="card bg-base-100 p-3 shadow-sm">
															<h3 class="font-semibold flex items-center gap-2 mb-2"><LucideInfo class="w-4 h-4" /> Details</h3>
															<p><span class="opacity-70">Referrer:</span> {entry.referrer || 'N/A'}</p>
															<p><span class="opacity-70">User Agent:</span> {entry.userAgent}</p>
															<p><span class="opacity-70">Source File:</span> {entry.sourceFile}</p>
														</div>
														<div class="card bg-base-100 p-3 shadow-sm">
															<h3 class="font-semibold mb-2">Raw Log</h3>
															<pre class="whitespace-pre-wrap text-xs bg-base-300 p-2 rounded">{entry.rawLog}</pre>
														</div>
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							{:else}
								<div class="p-4 text-center">
									<p>No log entries to display.</p>
								</div>
						{/if}
					</div>
				{:else}
					<div class="bg-base-300 rounded-lg p-4 flex items-center justify-center h-[70vh] text-center text-base-content/50">
						<div>
							<p>No log content to display.</p>
							<p class="mt-2">Enter your SSH credentials and connect to view the access log files.</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
