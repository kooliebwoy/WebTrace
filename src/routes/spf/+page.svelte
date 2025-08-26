<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { Mail, ChevronLeft, AlertCircle, CheckCircle, XCircle, AlertTriangle } from '@lucide/svelte';
  import { onMount } from 'svelte';

  export let form: ActionData;

  let isLoading = false;
  let domainInput = '';
  let spfData: any = null;

  onMount(() => {
    // Focus on input field
    const inputElement = document.getElementById('domain-input');
    if (inputElement) {
      inputElement.focus();
    }
  });

  // Handle the form submission with enhancement
  const handleSubmit = () => {
    isLoading = true;
    spfData = null;
    
    return ({ result, update }: { result: any, update: () => void }) => {
      if (result.type === 'success' && result.data?.spfResult) {
        spfData = result.data.spfResult;
      }
      isLoading = false;
      update();
    };
  };

  function getScoreClass(score: number): string {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  }

  function getScoreProgressClass(score: number): string {
    if (score >= 90) return 'progress-success';
    if (score >= 70) return 'progress-warning';
    return 'progress-error';
  }

  function getCategoryIcon(category: string) {
    switch (category) {
      case 'ip': return 'network-wired';
      case 'domain': return 'globe';
      case 'mechanism': return 'cog';
      case 'modifier': return 'sliders-h';
      default: return 'question-circle';
    }
  }

  function getMechanismLabel(type: string, isValid: boolean): string {
    if (!isValid) return 'bg-error text-error-content';
    
    switch (type) {
      case 'version': return 'bg-neutral text-neutral-content';
      case 'all': return 'bg-primary text-primary-content';
      case 'include': return 'bg-secondary text-secondary-content';
      case 'ip4': 
      case 'ip6': return 'bg-info text-info-content';
      case 'a':
      case 'mx': return 'bg-accent text-accent-content';
      case 'redirect': return 'bg-warning text-warning-content';
      default: return 'bg-base-300 text-base-content';
    }
  }

  function getStatusIndicator(isValid: boolean, hasWarnings: boolean) {
    if (!isValid) return { icon: XCircle, text: 'Invalid', color: 'text-error' };
    if (hasWarnings) return { icon: AlertTriangle, text: 'Warnings', color: 'text-warning' };
    return { icon: CheckCircle, text: 'Valid', color: 'text-success' };
  }
</script>

<svelte:head>
  <title>SPF Validator | WebTrace</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-6 bg-base-200">
  <!-- Main content container with adaptive layout -->
  <div class="w-full max-w-[1400px]" 
       class:flex={!spfData && !isLoading}
       class:items-center={!spfData && !isLoading}
       class:justify-center={!spfData || isLoading}
       class:grid={spfData && !isLoading}
       class:grid-cols-1={spfData && !isLoading}
       class:lg:grid-cols-2={spfData && !isLoading}
       class:lg:grid-cols-[minmax(350px,1fr)_minmax(500px,2fr)]={spfData && !isLoading}
       class:gap-6={spfData && !isLoading}
       class:lg:gap-10={spfData && !isLoading}>
    
    <!-- Input Card -->
    <div class="card w-[min(350px,95vw)] bg-base-100 shadow-xl transition-all duration-500"
         class:self-start={spfData && !isLoading}
         class:justify-self-center={spfData && !isLoading}
         in:fade={{duration: 300}}>
      
      <!-- Card Header -->
      <div class="bg-warning text-warning-content p-5">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Mail class="h-6 w-6" />
          SPF Validator
        </h2>
        <p class="text-sm opacity-80 mt-1">Validate SPF records for email domains</p>
      </div>
      
      <!-- Card Body -->
      <div class="card-body p-6">
        <form method="post" action="?/spfCheck" class="flex flex-col gap-4" use:enhance={handleSubmit}>
          <div class="form-control">
            <label class="label pb-1" for="domain-input">
              <span class="label-text font-medium">Domain name</span>
            </label>
            <input 
              type="text" 
              id="domain-input"
              name="domain" 
              bind:value={domainInput}
              placeholder="example.com" 
              class="input input-bordered w-full"
              required
            />
            <p class="label pt-1">
              <span class="label-text-alt opacity-70">Enter a domain to check its SPF records</span>
            </p>
          </div>
          
          {#if form?.error}
            <div class="alert alert-error text-sm py-2" transition:fade>
              <AlertCircle class="h-4 w-4" />
              <span>{form.error}</span>
            </div>
          {/if}
          
          <button 
            type="submit" 
            class="btn btn-warning w-full"
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm"></span>
              <span>Validating...</span>
            {:else}
              <span>Validate SPF</span>
            {/if}
          </button>
          
          <a href="/" class="btn btn-outline btn-sm w-full gap-1">
            <ChevronLeft class="h-4 w-4" />
            <span>Back to tools</span>
          </a>
        </form>
      </div>
    </div>
    
    <!-- Results Card -->
    {#if spfData && !isLoading}
      <div class="card w-full bg-base-100 shadow-xl transition-all duration-500 self-start justify-self-center"
           in:fly={{y: 20, duration: 400, easing: quintOut}}>
        
        <div class="card-body p-6">
          <!-- Domain and Score Header -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
            <div>
              <h3 class="text-xl font-bold">{spfData.domain}</h3>
              <p class="text-sm opacity-70">SPF Record Analysis</p>
            </div>
            
            <div class="flex flex-col items-end">
              {#if true}
                {@const status = getStatusIndicator(spfData.isValid, spfData.hasWarnings)}
                <div class="flex items-center gap-2">
                  <span class="font-bold text-2xl {getScoreClass(spfData.score)}">{spfData.score}/100</span>
                  <span class="badge {status.color} badge-sm gap-1 py-2">
                    <svelte:component this={status.icon} class="h-3 w-3" />
                    {status.text}
                  </span>
                </div>
              {/if}
              <progress 
                class="progress {getScoreProgressClass(spfData.score)} w-32 h-2" 
                value={spfData.score} 
                max="100"
              ></progress>
            </div>
          </div>
          
          <!-- Raw SPF Records -->
          <div class="mb-5">
            <h4 class="font-bold mb-2">Raw SPF Records</h4>
            {#if spfData.records.raw.length > 0}
              <div class="bg-base-200 p-3 rounded-lg overflow-x-auto">
                {#each spfData.records.raw as record}
                  <pre class="text-sm">{record}</pre>
                {/each}
              </div>
            {:else}
              <div class="alert alert-warning text-sm">
                <AlertTriangle class="h-4 w-4" />
                <span>No SPF records found for this domain</span>
              </div>
            {/if}
          </div>
          
          <!-- Parsed Mechanisms -->
          {#if spfData.records.parsed.length > 0}
            <div class="mb-5">
              <h4 class="font-bold mb-2">Parsed Mechanisms</h4>
              <div class="overflow-x-auto">
                <table class="table table-zebra table-sm w-full">
                  <thead>
                    <tr>
                      <th class="w-24">Type</th>
                      <th>Value</th>
                      <th class="hidden md:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each spfData.records.parsed as item}
                      <tr>
                        <td>
                          <span class="badge {getMechanismLabel(item.type, item.isValid)} py-1">
                            {item.type}
                          </span>
                        </td>
                        <td class="font-mono text-sm">
                          {item.value}
                          {#if !item.isValid}
                            <span class="badge badge-error badge-sm ml-2">Invalid</span>
                          {/if}
                        </td>
                        <td class="hidden md:table-cell text-sm opacity-80">{item.description}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}
          
          <!-- Issues and Recommendations -->
          <div class="flex flex-col md:flex-row gap-5">
            <!-- Errors -->
            <div class="flex-1">
              <h4 class="font-bold mb-2 text-error flex items-center gap-1">
                <XCircle class="h-4 w-4" />
                <span>Errors</span>
              </h4>
              {#if spfData.errors.length > 0}
                <ul class="list-disc list-inside space-y-1">
                  {#each spfData.errors as error}
                    <li class="text-sm">{error}</li>
                  {/each}
                </ul>
              {:else}
                <p class="text-sm opacity-70">No errors found.</p>
              {/if}
            </div>
            
            <!-- Warnings -->
            <div class="flex-1">
              <h4 class="font-bold mb-2 text-warning flex items-center gap-1">
                <AlertTriangle class="h-4 w-4" />
                <span>Warnings</span>
              </h4>
              {#if spfData.warnings.length > 0}
                <ul class="list-disc list-inside space-y-1">
                  {#each spfData.warnings as warning}
                    <li class="text-sm">{warning}</li>
                  {/each}
                </ul>
              {:else}
                <p class="text-sm opacity-70">No warnings found.</p>
              {/if}
            </div>
          </div>
          
          <!-- SPF Recommendations -->
          <div class="mt-4">
            <h4 class="font-bold mb-2">Recommendations</h4>
            <div class="bg-base-200 p-4 rounded-lg">
              <ul class="list-disc list-inside space-y-2 text-sm">
                {#if !spfData.records.raw.length}
                  <li>Add an SPF record to protect your domain from email spoofing.</li>
                {/if}
                
                {#if !spfData.records.parsed.some((item: any) => item.type === 'all' && item.value === '-all')}
                  <li>Add a "-all" mechanism as the last element to block unauthorized senders.</li>
                {/if}
                
                {#if spfData.records.parsed.some((item: any) => item.type === 'all' && (item.value === '+all' || item.value === 'all'))}
                  <li class="text-error font-medium">Replace "+all" with "-all" to prevent email spoofing!</li>
                {/if}
                
                {#if spfData.records.parsed.some((item: any) => item.type === 'all' && item.value === '?all')}
                  <li>Consider replacing "?all" with "~all" or "-all" for better security.</li>
                {/if}
                
                {#if !spfData.records.parsed.some((item: any) => item.type === 'ip4' || item.type === 'ip6' || item.type === 'a' || item.type === 'mx')}
                  <li>Add specific mechanisms (ip4, ip6, a, mx) to authorize your legitimate email servers.</li>
                {/if}
                
                {#if spfData.records.raw.length > 1}
                  <li>Consolidate multiple SPF records into a single record to follow best practices.</li>
                {/if}
                
                <li>Regular SPF validation is recommended as email infrastructure changes.</li>
              </ul>
            </div>
          </div>
          
        </div>
      </div>
    {/if}
    
    <!-- Loading Indicator -->
    {#if isLoading}
      <div class="flex flex-col items-center justify-center gap-4 p-10 h-64" 
           in:fade={{duration: 200}}>
        <div class="loading loading-spinner loading-lg text-warning"></div>
        <p class="text-base-content/70 text-center">Validating SPF records for {domainInput}...</p>
      </div>
    {/if}
  </div>
</div>
