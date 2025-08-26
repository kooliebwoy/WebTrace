<script lang="ts">
	import { enhance } from '$app/forms';
	import { LucideLoader, LucideLock, LucideServer, LucideTerminal, LucideUser, LucideAlertCircle, LucideInfo, LucideCalendar, LucideUser2, LucideGlobe, LucideFile, LucideArchive, LucideKey } from '@lucide/svelte';
	import type { ActionData } from './$types';
	
	export let form: ActionData;
	
	let isLoading = false;
	let showPrivateKey = false;
	let usePrivateKey = false;
	let selectedLogFiles: string[] = [];
	
	// Parse log entry to extract useful information
	function parseLogEntry(logContent: string) {
		const entries = [];
		
		// Split by lines or by complete log entries if they span multiple lines
		const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
		
		let currentFile = '';
		
		for (const line of logLines) {
			// Check if this is a file header line
			const fileHeaderMatch = line.match(/^--- From (.+) ---$/);
			if (fileHeaderMatch) {
				currentFile = fileHeaderMatch[1].split('/').pop() || '';
				continue;
			}
			
			// Skip lines that don't match our filter (if any)
			if (selectedLogFiles.length > 0 && currentFile && !selectedLogFiles.includes(currentFile)) {
				continue;
			}
			
			// Try to parse timestamp, error level, message
			const timestampMatch = line.match(/^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
			let timestamp = timestampMatch ? timestampMatch[1] : 'Unknown time';

			// Convert timestamp to local time if possible
			if (timestamp !== 'Unknown time') {
				try {
					// Parse the log timestamp format (2025/07/10 03:19:10)
					const [datePart, timePart] = timestamp.split(' ');
					const [year, month, day] = datePart.split('/');
					const [hour, minute, second] = timePart.split(':');

					// Create a date object
					const date = new Date(
						parseInt(year),
						parseInt(month) - 1,
						parseInt(day),
						parseInt(hour),
						parseInt(minute),
						parseInt(second)
					);
					
					// Format it in a more readable format
					timestamp = date.toLocaleString();
				} catch (e) {
					console.error('Error parsing timestamp:', e);
				}
			}
			
			// Extract error level
			let level = 'INFO';
			if (line.includes('[error]')) level = 'ERROR';
			else if (line.includes('[warn]')) level = 'WARNING';
			else if (line.includes('[notice]')) level = 'NOTICE';
			
			// Extract message
			let message = line;
			if (timestampMatch) {
				message = line.substring(timestampMatch[0].length).trim();
			}
			
			// Extract request details like client IP, host
			const ipMatch = line.match(/\[client\s+([^\]]+)\]/);
			const client = ipMatch ? ipMatch[1] : 'Unknown';
			
			// Extract request path
			const requestMatch = line.match(/request: "([^"]+)"/);
			const request = requestMatch ? requestMatch[1] : '';
			
			// Extract host if available
			const hostMatch = line.match(/host: "([^"]+)"/i);
			const host = hostMatch ? hostMatch[1] : '';
			
			// Look for PHP errors and extract file, line, and message
			const phpErrorMatch = line.match(/PHP\s+(\w+):(.*?)\s+in\s+(.+?)\s+on\s+line\s+(\d+)/i);
			const phpError = phpErrorMatch ? {
				type: phpErrorMatch[1],
				message: phpErrorMatch[2].trim(),
				file: phpErrorMatch[3],
				line: phpErrorMatch[4]
			} : null;
			
			entries.push({
				timestamp,
				level,
				message,
				client,
				request,
				host,
				sourceFile: currentFile,
				phpError,
				// Create a simplified message for non-technical users
				simplifiedMessage: phpError 
					? `PHP ${phpError.type} in ${phpError.file.split('/').pop()} on line ${phpError.line}: ${phpError.message}`
					: message.replace(/\[client.*?\]\s*/, '')
			});
		}
		
		return entries;
	}
	
	$: availableLogFiles = form?.logFiles || [];
	$: allLogEntries = form?.logContent ? parseLogEntry(form.logContent) : [];
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
		selectedLogFiles = availableLogFiles
			.map((file) => file.name)
			.filter((n): n is string => Boolean(n));
	}
	
	function deselectAllLogFiles() {
		selectedLogFiles = [];
	}
</script>

<svelte:head>
	<title>Error Logs | WebTrace Analytics</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="text-2xl font-bold mb-6">Error Logs</h1>
	
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
					Error Logs
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
										class="btn btn-sm {selectedLogFiles.includes(file.name ?? '') ? 'btn-primary' : 'btn-outline'}"
										on:click={() => file.name && toggleLogFileSelection(file.name)}
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
								<table class="table table-zebra w-full">
									<!-- Table header -->
									<thead>
										<tr>
											<th class="text-left">#</th>
											<th class="text-left">Status</th>
											<th class="text-left">Source</th>
											<th class="text-left">IP Address</th>
											<th class="text-left">Timestamp</th>
											<th class="text-left">Host</th>
											<th class="text-left">Message</th>
										</tr>
									</thead>
									
									<!-- Table body -->
									<tbody>
										{#each filteredLogEntries as entry, i}
											<tr class="hover:bg-base-100 cursor-pointer" 
												on:click={() => {
													const el = document.getElementById(`log-details-${i}`) as HTMLDetailsElement | null;
													if (el) el.open = !el.open;
												}}>
												
												<!-- Row number -->
												<td class="font-mono">{filteredLogEntries.length - i}</td>
												
												<!-- Status/Level -->
												<td>
													<div class="badge {entry.level === 'ERROR' ? 'badge-error' : entry.level === 'WARNING' ? 'badge-warning' : 'badge-info'}">
														{entry.level}
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
												
												<!-- Client IP -->
												<td class="font-mono">
													{#if entry.client && entry.client !== 'Unknown'}
														{entry.client}
													{:else}
														<span class="opacity-50">-</span>
													{/if}
												</td>
												
												<!-- Timestamp -->
												<td>
													<div class="flex items-center gap-1">
														<LucideCalendar class="w-3 h-3 text-secondary" />
														{entry.timestamp}
													</div>
												</td>
												
												<!-- Host -->
												<td class="font-mono text-xs">
													{#if entry.host}
														{entry.host}
													{:else}
														<span class="opacity-50">-</span>
													{/if}
												</td>
												
												<!-- Message -->
												<td class="text-sm">
													<div class="truncate max-w-[300px]">
														{entry.simplifiedMessage || entry.message}
													</div>
												</td>
											</tr>
											
											<!-- Expandable details row -->
											<tr class="bg-base-200">
												<td colspan="7" class="p-0">
													<details id="log-details-{i}" class="w-full">
														<summary class="sr-only">Details</summary>
														<div class="p-4 bg-base-200">
															<!-- Additional details -->
															<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
																{#if entry.phpError}
																	<div class="card bg-base-100 p-3 shadow-sm">
																		<h3 class="font-semibold flex items-center gap-2">
																			<LucideInfo class="w-4 h-4" />
																			File Information
																		</h3>
																		<div class="mt-2 text-sm">
																			<p><span class="opacity-70">Path:</span> {entry.phpError.file}</p>
																			<p><span class="opacity-70">Line:</span> {entry.phpError.line}</p>
																			<p><span class="opacity-70">Error Type:</span> {entry.phpError.type}</p>
																		</div>
																	</div>
																{/if}
																
																{#if entry.request}
																	<div class="card bg-base-100 p-3 shadow-sm">
																		<h3 class="font-semibold flex items-center gap-2">
																			<LucideTerminal class="w-4 h-4" />
																			Request
																		</h3>
																		<div class="mt-2 text-sm break-all">
																			{entry.request}
																		</div>
																	</div>
																{/if}
																
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
																<pre class="whitespace-pre-wrap text-xs bg-base-300 p-2 rounded">{entry.message}</pre>
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
							<p class="mt-2">Enter your SSH credentials and connect to view the error log files.</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
