<script lang="ts">
  import { enhance } from '$app/forms';
  import { Globe, Server, Clock, Check, AlertTriangle, RefreshCw, Loader2 } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import type { ActionData, PageData } from './$types';
  
  export let form: ActionData;
  
  // Available DNS record types
  const recordTypes = [
    { value: 'A', label: 'A (IPv4 Address)' },
    { value: 'AAAA', label: 'AAAA (IPv6 Address)' },
    { value: 'MX', label: 'MX (Mail Exchange)' },
    { value: 'TXT', label: 'TXT (Text)' },
    { value: 'NS', label: 'NS (Name Server)' },
    { value: 'CNAME', label: 'CNAME (Canonical Name)' }
  ];
  
  let domain = '';
  let selectedRecordType = 'A';
  let isSubmitting = false;
  
  // For form submission with enhanced user feedback
  function handleSubmit(_args?: {
    action: URL;
    formData: FormData;
    formElement: HTMLFormElement;
    controller: AbortController;
    submitter: HTMLElement | null;
    cancel: () => void;
  }) {
    isSubmitting = true;
    return async ({ update }: { update: () => Promise<void>; result?: unknown }) => {
      try {
        await update();
      } finally {
        isSubmitting = false;
      }
    };
  }
  
  // Format response time to be more readable
  function formatResponseTime(ms: number): string {
    if (ms < 100) return `${ms}ms`;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
  
  // Get color based on propagation percentage
  function getPropagationColor(percentage: number): string {
    if (percentage >= 90) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-error';
  }
  
  // Get color based on response time
  function getResponseTimeColor(ms: number): string {
    if (ms < 150) return 'text-success';
    if (ms < 500) return 'text-warning';
    return 'text-error';
  }
  
  // Group results by geographic region
  type PropagationResult = {
    propagated: boolean;
    responseTime: number;
    error?: string;
    records?: Array<{ value: string }>;
    server: { name: string; provider: string; location: string };
  };

  function groupByRegion(results: PropagationResult[]): Array<{ region: string; servers: PropagationResult[] }> {
    const groups: Record<string, PropagationResult[]> = {};
    
    results.forEach((result) => {
      const region = result.server.location;
      if (!groups[region]) {
        groups[region] = [];
      }
      groups[region].push(result);
    });
    
    return Object.entries(groups).map(([region, servers]) => ({
      region,
      servers
    }));
  }
</script>

<svelte:head>
  <title>DNS Propagation Checker | WebTrace</title>
  <meta name="description" content="Check DNS record propagation across global DNS servers">
</svelte:head>

<div class="flex flex-col gap-4 pb-4">
  <header>
    <h1 class="text-xl font-bold flex items-center gap-2">
      <Globe class="inline-block h-5 w-5" /> DNS Propagation Checker
    </h1>
  </header>
  
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <!-- Input Section -->
    <div class="lg:col-span-1">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4">
          
          <form method="post" action="?/checkPropagation" class="space-y-3" use:enhance={handleSubmit}>
            <div>
              <label for="domain-input" class="block text-sm font-medium mb-1">Domain</label>
              <input
                id="domain-input"
                type="text"
                name="domain"
                bind:value={domain}
                placeholder="example.com"
                class="input input-bordered w-full"
                autocomplete="off"
                required
              />
            </div>
            
            <div>
              <label for="record-type-select" class="block text-sm font-medium mb-1">Record Type</label>
              <select
                id="record-type-select"
                name="recordType"
                bind:value={selectedRecordType}
                class="select select-bordered w-full"
              >
                {#each recordTypes as type}
                  <option value={type.value}>{type.label}</option>
                {/each}
              </select>
            </div>
            
            <button
              type="submit"
              class="btn btn-primary mt-2 gap-2"
              disabled={isSubmitting}
            >
              {#if isSubmitting}
                <span class="loading loading-spinner loading-sm"></span>
                Checking...
              {:else}
                <RefreshCw class="h-5 w-5" />
                Check Propagation
              {/if}
            </button>
          </form>
          
          {#if form?.error}
            <div class="alert alert-error mt-4" transition:fly={{ y: 20, duration: 300 }}>
              <AlertTriangle class="h-5 w-5" />
              <span>{form.error}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Results Section -->
    <div class="lg:col-span-3">
      {#if form && !form.error && form.results}
        <div in:fly={{ y: 20, duration: 300, delay: 300 }}>
          <!-- Summary Card -->
          <div class="card bg-base-100 shadow-lg mb-4">
            <div class="card-body">
              <div class="flex flex-wrap justify-between items-center gap-4">
                <h2 class="card-title">
                  Results for <span class="text-primary">{form.domain}</span> ({form.recordType})
                </h2>
                <div class="text-sm opacity-75">
                  <Clock class="inline-block h-4 w-4 mr-1" />
                  {new Date(form?.timestamp || Date.now()).toLocaleString()}
                </div>
              </div>
              
              <div class="divider my-2"></div>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Propagation Status -->
                <div class="stat bg-base-200 rounded-box p-4">
                  <div class="stat-title">Propagation Status</div>
                  <div class="stat-value text-3xl {getPropagationColor(form.propagationPercentage)}">
                    {form.propagationPercentage.toFixed(0)}%
                  </div>
                  <div class="stat-desc">
                    {form.results.filter(r => r.propagated).length} of {form.results.length} servers
                  </div>
                </div>
                
                <!-- Consistency -->
                <div class="stat bg-base-200 rounded-box p-4">
                  <div class="stat-title">Record Consistency</div>
                  <div class="stat-value text-3xl">
                    {#if form.isConsistent}
                      <span class="text-success">Consistent</span>
                    {:else}
                      <span class="text-error">Inconsistent</span>
                    {/if}
                  </div>
                  <div class="stat-desc">
                    {form.isConsistent ? 'All servers report identical records' : 'Records differ between servers'}
                  </div>
                </div>
                
                <!-- Average Response Time -->
                <div class="stat bg-base-200 rounded-box p-4">
                  <div class="stat-title">Avg Response Time</div>
                  {#if form.results.length > 0}
                    {@const avgTime = form.results.reduce((acc, r) => acc + r.responseTime, 0) / form.results.length}
                    <div class="stat-value text-3xl {getResponseTimeColor(avgTime)}">
                      {formatResponseTime(avgTime)}
                    </div>
                  {:else}
                    <div class="stat-value text-3xl">N/A</div>
                  {/if}
                  <div class="stat-desc">
                    Time to resolve DNS records
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Server Status -->
          <div class="card bg-base-100 shadow-lg mb-4">
            <div class="card-body p-4">
              <h2 class="card-title mb-3 text-lg">Server Status</h2>
              
              <div class="w-full bg-base-200 rounded-full h-3 mb-4">
                <div 
                  class="bg-primary h-3 rounded-full transition-all duration-1000"
                  style="width: {form.propagationPercentage}%"
                ></div>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {#each form.results as result, i}
                  <div 
                    class="flex items-center justify-between p-2 bg-base-200 rounded-lg"
                    in:fly={{y: 10, delay: 300 + (i * 30), duration: 200}}
                  >
                    <div class="flex items-center gap-2">
                      {#if result.propagated}
                        <Check class="h-4 w-4 text-success" />
                      {:else}
                        <AlertTriangle class="h-4 w-4 text-error" />
                      {/if}
                      <div>
                        <div class="font-medium text-sm">{result.server.name}</div>
                        <div class="text-xs opacity-70">{result.server.provider}</div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-xs {getResponseTimeColor(result.responseTime)}">
                        {formatResponseTime(result.responseTime)}
                      </div>
                      <div class="text-xs opacity-70">{result.server.location}</div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
          
          <!-- Detailed Results -->
          <div class="card bg-base-100 shadow-lg">
            <div class="card-body">
              <h2 class="card-title mb-4">Detailed Results</h2>
              
              {#if form.results.filter(r => r.propagated).length === 0}
                <div class="alert alert-warning">
                  <AlertTriangle class="h-5 w-5" />
                  <span>No DNS records found on any server. This domain may not exist or have the specified record type.</span>
                </div>
              {:else}
                <div class="overflow-x-auto">
                  <table class="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>DNS Server</th>
                        <th>Location</th>
                        <th>Records</th>
                        <th>Response Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each form.results as result}
                        <tr class={result.propagated ? '' : 'opacity-60'}>
                          <td>
                            <div class="font-medium">{result.server.name}</div>
                            <div class="text-xs opacity-75">{result.server.provider}</div>
                          </td>
                          <td>{result.server.location}</td>
                          <td>
                            {#if result.propagated}
                              {#each result.records as record}
                                <div class="badge badge-outline mb-1">{record.value}</div>
                              {/each}
                            {:else}
                              <span class="text-error">No records found</span>
                              {#if result.error}
                                <div class="text-xs opacity-75 mt-1">{result.error}</div>
                              {/if}
                            {/if}
                          </td>
                          <td class={getResponseTimeColor(result.responseTime)}>
                            {formatResponseTime(result.responseTime)}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else if !form}
        <div class="card bg-base-100 shadow-lg h-full flex items-center justify-center p-8">
          <div class="text-center opacity-70">
            <Globe class="mx-auto h-16 w-16 mb-4 opacity-50" />
            <h3 class="text-xl font-medium mb-2">Check DNS Propagation</h3>
            <p>Enter a domain name and record type to check its propagation status across global DNS servers.</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
