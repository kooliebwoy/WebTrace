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
  function handleSubmit() {
    return ({ update }) => {
      isSubmitting = true;
      return async ({ result }) => {
        isSubmitting = false;
        await update();
      };
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
  function groupByRegion(results) {
    const groups = {};
    
    results.forEach(result => {
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
  <title>DNS Propagation Checker | RouteKit</title>
  <meta name="description" content="Check DNS record propagation across global DNS servers">
</svelte:head>

<div class="flex flex-col gap-8 pb-8">
  <header>
    <h1 class="text-3xl font-bold mb-2 flex items-center gap-2">
      <Globe class="inline-block" /> DNS Propagation Checker
    </h1>
    <p class="text-base-content/80">
      Check how DNS records are propagated across global DNS servers. Track propagation status,
      compare records, and identify inconsistencies.
    </p>
  </header>
  
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- Input Section -->
    <div class="lg:col-span-4">
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2 mb-4">
            <Server class="inline-block h-5 w-5" /> Check Propagation
          </h2>
          
          <form method="post" action="?/checkPropagation" class="flex flex-col gap-4" use:enhance={handleSubmit}>
            <div class="form-control">
              <label class="label pb-1" for="domain-input">
                <span class="label-text font-medium">Domain name</span>
              </label>
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
              <label class="label pt-0">
                <span class="label-text-alt">Enter a domain name without protocol (http/https)</span>
              </label>
            </div>
            
            <div class="form-control">
              <label class="label pb-1" for="record-type-select">
                <span class="label-text font-medium">Record type</span>
              </label>
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
              <label class="label pt-0">
                <span class="label-text-alt">Select the DNS record type to check</span>
              </label>
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
      
      <!-- How it works -->
      <div class="card bg-base-100 shadow-lg mt-6">
        <div class="card-body">
          <h3 class="card-title text-lg">How it works</h3>
          <div class="text-sm opacity-90 space-y-2">
            <p>
              This tool checks DNS record propagation across multiple global DNS providers to determine if 
              your DNS changes have propagated worldwide.
            </p>
            <p>
              We query 10 different DNS servers from various providers and locations to verify 
              your records are consistent and available globally.
            </p>
            <p>
              Results include propagation status, response times, and record consistency to help diagnose 
              DNS-related issues.
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Results Section -->
    <div class="lg:col-span-8">
      {#if form && !form.error && form.results}
        <div in:fly={{ y: 20, duration: 300, delay: 300 }}>
          <!-- Summary Card -->
          <div class="card bg-base-100 shadow-lg mb-6">
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
          
          <!-- Propagation Timeline -->
          <div class="card bg-base-100 shadow-lg mb-6">
            <div class="card-body">
              <h2 class="card-title mb-4">Propagation Timeline</h2>
              
              <div class="w-full bg-base-200 rounded-full h-4 mb-6">
                <div 
                  class="bg-primary h-4 rounded-full transition-all duration-1000"
                  style="width: {form.propagationPercentage}%"
                ></div>
              </div>
              

              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {#each form.results as result, i}
                  <div 
                    class="card bg-base-200 shadow-sm"
                    in:fly={{y: 20, delay: 400 + (i * 50), duration: 300}}
                  >
                    <div class="card-body p-3">
                      <div class="flex justify-between items-center">
                        <h3 class="font-medium">{result.server.name}</h3>
                        {#if result.propagated}
                          <span class="badge badge-success gap-1">
                            <Check class="h-3 w-3" /> Propagated
                          </span>
                        {:else}
                          <span class="badge badge-error gap-1">
                            <AlertTriangle class="h-3 w-3" /> Not Found
                          </span>
                        {/if}
                      </div>
                      <p class="text-xs opacity-75">{result.server.provider} • {result.server.location}</p>
                      <p class="text-xs opacity-75">
                        <span class={getResponseTimeColor(result.responseTime)}>
                          {formatResponseTime(result.responseTime)}
                        </span>
                      </p>
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
                            <div class="text-xs opacity-75">{result.server.ip}</div>
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
