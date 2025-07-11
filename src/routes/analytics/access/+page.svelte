<script lang="ts">
	import { enhance } from '$app/forms';
	import { LucideLoader, LucideLock, LucideServer, LucideTerminal, LucideUser, LucideGlobe, LucideFile, LucideArchive, LucideCalendar, LucideRefreshCw, LucideArrowRight, LucideInfo, LucideKey, LucideAlertCircle } from '@lucide/svelte';
	import type { ActionData } from './$types';
	
	export let data;
	export let form: ActionData;
	
	let isLoading = false;
	let showPrivateKey = false;
	let usePrivateKey = false;
	let selectedLogFiles: string[] = [];
	
	// Parse access log entry to extract useful information
	function parseLogEntry(logContent: string) {
		console.log('Starting to parse log content...');
		const entries = [];
		
		// Split by lines
		const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
		console.log(`Found ${logLines.length} non-empty log lines`);
		
		let currentFile = '';
		
		for (const line of logLines) {
			// Check if this is a file header line
			const fileHeaderMatch = line.match(/^--- From (.+) ---$/);
			if (fileHeaderMatch) {
				currentFile = fileHeaderMatch[1].split('/').pop() || '';
				console.log('Found file header:', currentFile);
				continue;
			}
			
			// Skip lines that don't match our filter (if any)
			if (selectedLogFiles.length > 0 && currentFile && !selectedLogFiles.includes(currentFile)) {
				continue;
			}
			
			console.log('Processing line:', line.substring(0, 50) + '...');
			
			// Skip any line that doesn't look like a log entry
			if (!line.includes('[') || !line.includes(']')) {
				console.log('Skipping invalid line (no timestamp brackets)');
				continue;
			}
			
			try {
				// Split line into parts for domain, IP, timestamp, request, status, etc.
				const parts = line.split(' ');
				
				if (parts.length < 6) {
					console.log('Skipping - not enough parts in line');
					continue;
				}
				
				// First two parts are typically hostname and IP
				const hostname = parts[0] || '-';
				const ip = parts[1] || '-';
				
				// Extract timestamp which is in format [11/Jul/2025:01:02:02 +0000]
				const timestampMatch = line.match(/\[([^\]]+)\]/);
				const timestamp = timestampMatch ? timestampMatch[1] : 'Unknown';
				
				// Extract HTTP request (method, path, protocol) - it's between quotes
				const requestMatch = line.match(/"([^"]*)"/);
				let method = '-';
				let path = '-';
				let protocol = '-';
				
				if (requestMatch) {
					const request = requestMatch[1];
					const requestParts = request.split(' ');
					if (requestParts.length >= 3) {
						[method, path, protocol] = requestParts;
					} else if (requestParts.length === 2) {
						[method, path] = requestParts;
					} else if (requestParts.length === 1 && requestParts[0]) {
						path = requestParts[0];
					}
				}
				
				// Find index of the HTTP status code - it should be after the first quote-enclosed part
				let statusCode = '200'; // Default if not found
				let bytesSize = '-';
				let referrer = '-';
				let userAgent = '-';
				
				// Find the position of the first quote-enclosed segment
				const requestEndPos = line.indexOf('"', line.indexOf('"') + 1) + 1;
				if (requestEndPos > 0) {
					const afterRequest = line.substring(requestEndPos).trim();
					const afterRequestParts = afterRequest.split(' ');
					
					if (afterRequestParts.length > 0) {
						// The first part should be the status code
						if (/^\d{3}$/.test(afterRequestParts[0])) {
							statusCode = afterRequestParts[0];
						}
						
						// The next part may be bytes
						if (afterRequestParts.length > 1) {
							bytesSize = afterRequestParts[1];
						}
					}
				}
				
				// Try to find referrer and user agent in quotes
				const quoteMatches = [];
				let pos = 0;
				while (pos < line.length) {
					const startQuote = line.indexOf('"', pos);
					if (startQuote === -1) break;
					
					const endQuote = line.indexOf('"', startQuote + 1);
					if (endQuote === -1) break;
					
					quoteMatches.push(line.substring(startQuote + 1, endQuote));
					pos = endQuote + 1;
				}
				
				// The second quoted part is typically the HTTP request
				// The third quoted part (if exists) is the referrer
				// The fourth quoted part (if exists) is the user agent
				if (quoteMatches.length >= 2) {
					if (quoteMatches.length >= 3) {
						referrer = quoteMatches[2];
					}
					
					if (quoteMatches.length >= 4) {
						userAgent = quoteMatches[3];
					}
				}
				
				// Convert timestamp to local time if possible
				let formattedTime = timestamp;
				try {
					// Example: 11/Jul/2025:01:02:02 +0000
					const dateParts = timestamp.split(/[/:]/); 
					if (dateParts.length >= 6) {
						const day = dateParts[0];
						const month = {
							'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
							'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
						}[dateParts[1]];
						const year = dateParts[2];
						const hours = dateParts[3];
						const minutes = dateParts[4];
						const seconds = dateParts[5].split(' ')[0];
						
						if (month !== undefined) {
							const date = new Date(Date.UTC(
								parseInt(year),
								month,
								parseInt(day),
								parseInt(hours),
								parseInt(minutes),
								parseInt(seconds)
							));
							
							formattedTime = date.toLocaleString();
						}
					}
				} catch (e) {
					console.log('Error parsing timestamp:', timestamp, e);
				}
				
				// Status code type
				let statusType = 'success';
				if (/^\d{3}$/.test(statusCode)) {
					const statusNum = parseInt(statusCode);
					if (statusNum >= 400 && statusNum < 500) statusType = 'client-error';
					else if (statusNum >= 500) statusType = 'server-error';
					else if (statusNum >= 300 && statusNum < 400) statusType = 'redirect';
				}
				
				// Format the size if it's a number
				let formattedSize = bytesSize;
				if (!isNaN(parseInt(bytesSize))) {
					formattedSize = formatBytes(parseInt(bytesSize));
				}
				
				// Add the parsed entry to our entries array
				entries.push({
					hostname,
					ip,
					timestamp: formattedTime,
					rawTimestamp: timestamp,
					method,
					path,
					protocol,
					status: statusCode,
					statusType,
					size: formattedSize,
					referrer,
					userAgent,
					sourceFile: currentFile,
					rawLog: line
				});
			} catch (err) {
				console.error('Error parsing log line:', err, line);
				// If parse error, still add the raw line as an entry
				entries.push({
					hostname: '-',
					ip: '-',
					timestamp: 'Unknown',
					rawTimestamp: '',
					method: '-',
					path: '-',
					protocol: '-',
					status: '-',
					statusType: 'unknown',
					size: 'Unknown',
					referrer: '',
					userAgent: '',
					sourceFile: currentFile,
					rawLog: line
				});
			}
		}
		
		return entries;
	}
	
	// Format bytes to human-readable format
	function formatBytes(bytes: number, decimals = 2) {
		if (bytes === 0) return '0 Bytes';
		
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		
		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
	}

	let allLogEntries: any[] = [];
	
	
	$: availableLogFiles = form?.logFiles || [];
	$: {
		if (form?.logContent) {
			console.log('Log content length received:', form.logContent.length);
			console.log('First 200 characters of log content:', form.logContent.substring(0, 200));
			allLogEntries = parseLogEntry(form.logContent);
			console.log('Parsed entries count:', allLogEntries.length);
			if (allLogEntries.length === 0) {
				console.warn('No entries were parsed! Check the parsing function.');
			}
		} else {
			allLogEntries = [];
		}
	}
	$: filteredLogEntries = selectedLogFiles.length > 0 
		? allLogEntries.filter(entry => !entry.sourceFile || selectedLogFiles.includes(entry.sourceFile))
		: allLogEntries;
	
	function toggleLogFileSelection(fileName: string) {
		if (selectedLogFiles.includes(fileName)) {
			selectedLogFiles = selectedLogFiles.filter(f => f !== fileName);
		} else {
			selectedLogFiles = [...selectedLogFiles, fileName];
		}
	}
	
	function selectAllLogFiles() {
		selectedLogFiles = availableLogFiles.map(file => file.name);
	}
	
	function deselectAllLogFiles() {
		selectedLogFiles = [];
	}
</script>

<svelte:head>
	<title>Access Logs | Route Analytics</title>
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
					
					return async ({ result }) => {
						isLoading = false;
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
											on:click={() => showPrivateKey = !showPrivateKey}
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
									type={showPrivateKey ? 'text' : 'password'}
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
								on:click={() => {
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
		
		<!-- Log Content Display -->
		<div class="card bg-base-100 shadow-md">
			<div class="card-body">
				<h2 class="card-title">
					<LucideTerminal class="w-5 h-5" />
					Access Logs
				</h2>
				
				{#if isLoading}
					<div class="p-4 flex items-center justify-center">
						<LucideLoader class="w-8 h-8 animate-spin" />
					</div>
				{/if}
				
				{#if form?.success}
					<!-- File selection UI if multiple log files exist -->
					{#if form?.logFiles && form.logFiles.length > 0}
						<div class="mb-4">
							<div class="flex items-center justify-between mb-2">
								<h3 class="text-sm font-semibold">Log Files ({form.logFiles.length})</h3>
								<div class="flex gap-2">
									<button class="btn btn-xs" on:click={selectAllLogFiles}>Select All</button>
									<button class="btn btn-xs" on:click={deselectAllLogFiles}>Clear</button>
								</div>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each form.logFiles as file}
									<button 
										class="btn btn-sm {selectedLogFiles.includes(file.name) ? 'btn-primary' : 'btn-outline'}"
										on:click={() => toggleLogFileSelection(file.name)}
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
								<table class="table table-zebra w-full">
									<!-- Table header -->
									<thead>
										<tr>
											<th class="text-left">#</th>
											<th class="text-left">Status</th>
											<th class="text-left">Source</th>
											<th class="text-left">Method</th>
											<th class="text-left">IP Address</th>
											<th class="text-left">Timestamp</th>
											<th class="text-left">Path</th>
											<th class="text-left">Size</th>
										</tr>
									</thead>
									
									<!-- Table body -->
									<tbody>
										{#each filteredLogEntries as entry, i}
											<tr class="hover:bg-base-100 cursor-pointer" 
												on:click={() => {
													const el = document.getElementById(`log-details-${i}`);
													if (el) el.open = !el.open;
												}}>
												
												<!-- Row number -->
												<td class="font-mono">{filteredLogEntries.length - i}</td>
												
												<!-- Status code -->
												<td>
													<div class="badge {
														entry.statusType === 'server-error' ? 'badge-error' : 
														entry.statusType === 'client-error' ? 'badge-warning' : 
														entry.statusType === 'redirect' ? 'badge-info' : 
														entry.statusType === 'success' ? 'badge-success' : 'badge-ghost'
													}">
														{entry.status}
													</div>
												</td>
												
												<!-- Source File -->
												<td class="font-mono text-xs">
													{#if entry.sourceFile}
														<div class="flex items-center gap-1" title={entry.sourceFile}>
															{#if entry.sourceFile.endsWith('.gz')}
																<LucideArchive class="w-3 h-3 text-secondary" />
															{:else}
																<LucideFile class="w-3 h-3 text-secondary" />
															{/if}
															<span class="truncate max-w-[100px]">{entry.sourceFile}</span>
														</div>
													{:else}
														-
													{/if}
												</td>
												
												<!-- Method -->
												<td>
													<span class="font-semibold {
														entry.method === 'GET' ? 'text-success' : 
														entry.method === 'POST' ? 'text-info' : 
														entry.method === 'PUT' ? 'text-warning' : 
														entry.method === 'DELETE' ? 'text-error' : ''
													}">
														{entry.method}
													</span>
												</td>
												
												<!-- Client IP -->
												<td class="font-mono">
													{entry.ip}
												</td>
												
												<!-- Timestamp -->
												<td>
													<div class="flex items-center gap-1">
														<LucideCalendar class="w-3 h-3 text-secondary" />
														{entry.timestamp}
													</div>
												</td>
												
												<!-- Path -->
												<td class="text-xs">
													<div class="truncate max-w-[200px]" title={entry.path}>
														{entry.path}
													</div>
												</td>
												
												<!-- Size -->
												<td class="text-xs">
													{entry.size}
												</td>
											</tr>
											
											<!-- Expandable details row -->
											<tr class="bg-base-200">
												<td colspan="8" class="p-0">
													<details id="log-details-{i}" class="w-full">
														<summary class="sr-only">Details</summary>
														<div class="p-4 bg-base-200">
															<!-- Additional details -->
															<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
																<div class="card bg-base-100 p-3 shadow-sm">
																	<h3 class="font-semibold flex items-center gap-2">
																		<LucideGlobe class="w-4 h-4" />
																		Request Details
																	</h3>
																	<div class="mt-2 text-sm">
																		<p><span class="opacity-70">Method:</span> {entry.method}</p>
																		<p><span class="opacity-70">Path:</span> {entry.path}</p>
																		<p><span class="opacity-70">Protocol:</span> {entry.protocol}</p>
																		<p><span class="opacity-70">Status Code:</span> {entry.status}</p>
																		<p><span class="opacity-70">Size:</span> {entry.size}</p>
																	</div>
																</div>
																
																{#if entry.referrer}
																	<div class="card bg-base-100 p-3 shadow-sm">
																		<h3 class="font-semibold flex items-center gap-2">
																			<LucideArrowRight class="w-4 h-4" />
																			Referrer
																		</h3>
																		<div class="mt-2 text-sm break-all">
																			{entry.referrer}
																		</div>
																	</div>
																{/if}
																
																<div class="card bg-base-100 p-3 shadow-sm">
																	<h3 class="font-semibold flex items-center gap-2">
																		<LucideInfo class="w-4 h-4" />
																		Client Information
																	</h3>
																	<div class="mt-2 text-sm break-all">
																		<p><span class="opacity-70">IP Address:</span> {entry.ip}</p>
																		<p><span class="opacity-70">User Agent:</span> {entry.userAgent}</p>
																	</div>
																</div>
																
																{#if entry.sourceFile}
																	<div class="card bg-base-100 p-3 shadow-sm">
																		<h3 class="font-semibold flex items-center gap-2">
																			<LucideFile class="w-4 h-4" />
																			Source Log File
																		</h3>
																		<div class="mt-2 text-sm break-all">
																			{entry.sourceFile}
																		</div>
																	</div>
																{/if}
															</div>
															
															<!-- Raw log content -->
															<div class="card bg-base-100 p-3 shadow-sm">
																<h3 class="font-semibold mb-2">Raw Log</h3>
																<pre class="whitespace-pre-wrap text-xs bg-base-300 p-2 rounded">{entry.rawLog}</pre>
															</div>
														</div>
													</details>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else if form?.logFiles && form.logFiles.length > 0 && selectedLogFiles.length === 0}
							<div class="p-4 text-center">
								<p>Please select one or more log files to view.</p>
							</div>
						{:else if form?.logContent && form.logContent.length > 0}
							<div class="p-4 text-center">
								<p>Log files exist but contain no valid log entries.</p>
							</div>
						{:else}
							<div class="p-4 text-center">
								<p>Log files are empty.</p>
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
