<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, fly, slide } from 'svelte/transition';
  import { Globe, ArrowLeft, Check, XCircle, Shield, Clock, Server as ServerIcon, Code } from '@lucide/svelte';
  import type { ActionData } from './$types';
  import { goto } from '$app/navigation';
  
  export let form: ActionData;
  
  let url = '';
  let isLoading = false;
  let showCopiedToast = false;
  let selectedTab = 'all';
  
  $: headersData = form?.allHeaders;
  $: categorizedHeaders = form?.categorizedHeaders;
  $: securityScore = form?.securityScore;
  $: error = form?.error;
  
  function handleSubmit({ action, formData, formElement, controller, submitter, cancel }: {
    action: URL;
    formData: FormData;
    formElement: HTMLFormElement;
    controller: AbortController;
    submitter: HTMLElement | null;
    cancel: () => void;
  }) {
    isLoading = true;
    
    return async ({ result, update }: { result: unknown; update: () => Promise<void> }) => {
      isLoading = false;
      await update();
    };
  }
  
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showCopiedToast = true;
    setTimeout(() => showCopiedToast = false, 2000);
  }
  
  function getScoreColor(score: number) {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    if (score >= 40) return 'info';
    return 'error';
  }
  
  // Function to convert header names to more readable format
  function formatHeaderName(name: string) {
    return name
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
  }
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4 sm:p-6">
  <!-- Container with conditional classes for different layouts -->
  <div class="w-full max-w-[1400px] transition-all duration-500"
      class:flex={!headersData || isLoading}
      class:flex-col={!headersData || isLoading}
      class:items-center={!headersData || isLoading}
      class:justify-center={!headersData || isLoading}
      class:grid={headersData && !isLoading}
      class:grid-cols-1={headersData && !isLoading}
      class:lg:grid-cols-2={headersData && !isLoading}
      class:lg:grid-cols-[minmax(350px,1fr)_minmax(500px,2fr)]={headersData && !isLoading}
      class:gap-6={headersData && !isLoading}
      class:lg:gap-10={headersData && !isLoading}>
    
    <!-- Input Card -->
    <div class="card w-[min(350px,95vw)] bg-base-100 shadow-xl transition-all duration-500"
         class:self-start={headersData && !isLoading}
         class:justify-self-center={headersData && !isLoading}
         in:fade={{duration: 300}}>
      
      <!-- Card Header -->
      <div class="bg-success text-success-content p-5">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Globe class="h-6 w-6" />
          HTTP Headers
        </h2>
        <p class="text-sm opacity-80 mt-1">Analyze HTTP response headers</p>
      </div>
      
      <!-- Card Body -->
      <div class="card-body p-6">
        <form method="post" action="?/headersCheck" class="flex flex-col gap-4" use:enhance={handleSubmit}>
          <div class="form-control">
            <label class="label pb-1" for="headers-url">
              <span class="label-text font-medium">Domain or URL</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                class="input input-bordered w-full pr-12 font-mono text-sm" 
                name="url" 
                id="headers-url"
                bind:value={url} 
                placeholder="example.com" 
                required 
                minlength="4"
                disabled={isLoading} 
              />
              {#if url}
                <button 
                  type="button" 
                  class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle" 
                  onclick={() => url = ''}
                  aria-label="Clear input">
                  ✕
                </button>
              {/if}
            </div>
            <p class="label pt-0">
              <span class="label-text-alt">Protocol (http://) will be added if missing</span>
            </p>
          </div>
          
          <button 
            class="btn btn-success w-full mt-4 relative overflow-hidden" 
            type="submit" 
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm absolute"></span>
              <span class="opacity-0">Check Headers</span>
            {:else}
              <Globe class="w-4 h-4 mr-2" />
              Check Headers
            {/if}
          </button>
          
          <div class="mt-2">
            <button 
              type="button" 
              class="btn btn-ghost btn-xs w-full flex justify-center items-center gap-2" 
              onclick={() => goto('/')}
            >
              <ArrowLeft class="w-3 h-3" /> Back to tools
            </button>
          </div>
          
          {#if error}
            <div class="alert alert-error mt-2 shadow-md" transition:slide>
              <XCircle class="w-5 h-5" />
              <span>{error}</span>
            </div>
          {/if}
        </form>
      </div>
    </div>
    
    <!-- Results Card -->
    {#if headersData && !isLoading}
      <div class="card w-full bg-base-100 shadow-xl self-start overflow-hidden" in:fly={{x: 20, duration: 300, delay: 150}}>
        <div class="bg-base-200 p-4 border-b border-base-300 flex justify-between items-center">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Globe class="w-5 h-5" />
            <span class="font-mono text-sm truncate">{form?.url ?? ''}</span>
          </h3>
          
          <div class="flex gap-1">
            {#if form?.statusCode}
              <span class="badge badge-sm">Status: {form.statusCode} {form?.statusText ?? ''}</span>
            {/if}
            {#if securityScore}
              <span class="badge badge-sm badge-{getScoreColor(securityScore.score)}">
                Security: {securityScore.score}/{securityScore.max}
              </span>
            {/if}
          </div>
        </div>
        
        <!-- Tab Navigation -->
        <div class="tabs tabs-boxed bg-base-100 rounded-none px-4 pt-4">
          <button 
            class={`tab ${selectedTab === 'all' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'all'}
          >
            All Headers
          </button>
          <button 
            class={`tab ${selectedTab === 'security' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'security'}
          >
            Security
          </button>
          <button 
            class={`tab ${selectedTab === 'cache' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'cache'}
          >
            Cache
          </button>
          <button 
            class={`tab ${selectedTab === 'server' ? 'tab-active' : ''}`}
            onclick={() => selectedTab = 'server'}
          >
            Server
          </button>
        </div>
        
        <div class="p-6">
          {#if selectedTab === 'all'}
            <!-- All Headers Tab -->
            <div class="space-y-1">
              <div class="flex justify-between items-center mb-3">
                <h4 class="text-sm font-semibold text-base-content/70 uppercase">All Headers</h4>
                <button 
                  class="btn btn-xs btn-ghost"
                  onclick={() => copyToClipboard(JSON.stringify(headersData, null, 2))}
                >
                  <Check class="w-3.5 h-3.5 mr-1" />
                  Copy All
                </button>
              </div>
              
              <div class="overflow-x-auto">
                <table class="table table-zebra table-sm w-full">
                  <thead>
                    <tr>
                      <th class="w-1/3">Header</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each Object.entries(headersData) as [key, value]}
                      <tr>
                        <td class="font-mono text-xs whitespace-nowrap">{formatHeaderName(key)}</td>
                        <td class="font-mono text-xs break-all">{value}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else if selectedTab === 'security'}
            <!-- Security Headers Tab -->
            <div>
              {#if securityScore}
                <div class="mb-6">
                  <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Security Score</h4>
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold">{securityScore.score}/{securityScore.max}</span>
                      <span class="badge badge-{getScoreColor(securityScore.score)}">{securityScore.category}</span>
                    </div>
                    <progress class="progress progress-{getScoreColor(securityScore.score)}" value={securityScore.score} max={securityScore.max}></progress>
                  </div>
                </div>
              {/if}
              
              <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Security Headers</h4>
              {#if categorizedHeaders}
              <div class="space-y-3">
                {#each Object.entries(categorizedHeaders.security) as [key, value]}
                  <div class="bg-base-200 p-3 rounded-md">
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-sm">{formatHeaderName(key)}</span>
                      {#if value}
                        <span class="badge badge-success badge-sm">Present</span>
                      {:else}
                        <span class="badge badge-error badge-sm">Missing</span>
                      {/if}
                    </div>
                    {#if value}
                      <div class="mt-1 font-mono text-xs break-all">{value}</div>
                    {:else}
                      <div class="mt-1 italic text-xs opacity-70">This security header is not present</div>
                    {/if}
                  </div>
                {/each}
              </div>
              {/if}
            </div>
          {:else if selectedTab === 'cache'}
            <!-- Cache Headers Tab -->
            <div>
              <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Cache Headers</h4>
              {#if categorizedHeaders}
              <div class="space-y-3">
                {#each Object.entries(categorizedHeaders.cache) as [key, value]}
                  <div class="bg-base-200 p-3 rounded-md">
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-sm">{formatHeaderName(key)}</span>
                      {#if value}
                        <span class="badge badge-success badge-sm">Present</span>
                      {:else}
                        <span class="badge badge-warning badge-sm">Missing</span>
                      {/if}
                    </div>
                    {#if value}
                      <div class="mt-1 font-mono text-xs break-all">{value}</div>
                    {:else}
                      <div class="mt-1 italic text-xs opacity-70">This cache header is not present</div>
                    {/if}
                  </div>
                {/each}
              </div>
              {/if}
            </div>
          {:else if selectedTab === 'server'}
            <!-- Server Headers Tab -->
            <div>
              <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Server Headers</h4>
              {#if categorizedHeaders}
              <div class="space-y-3">
                {#each Object.entries(categorizedHeaders.server) as [key, value]}
                  <div class="bg-base-200 p-3 rounded-md">
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-sm">{formatHeaderName(key)}</span>
                      {#if value}
                        <span class="badge badge-info badge-sm">Present</span>
                      {:else}
                        <span class="badge badge-ghost badge-sm">Missing</span>
                      {/if}
                    </div>
                    {#if value}
                      <div class="mt-1 font-mono text-xs break-all">{value}</div>
                    {:else}
                      <div class="mt-1 italic text-xs opacity-70">This server header is not present</div>
                    {/if}
                  </div>
                {/each}
              </div>
              {/if}
              
              <div class="mt-6">
                <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Content Headers</h4>
                {#if categorizedHeaders}
                <div class="space-y-3">
                  {#each Object.entries(categorizedHeaders.content) as [key, value]}
                    {#if value}
                      <div class="bg-base-200 p-3 rounded-md">
                        <div class="flex items-center justify-between">
                          <span class="font-mono text-sm">{formatHeaderName(key)}</span>
                          <span class="badge badge-primary badge-sm">Present</span>
                        </div>
                        <div class="mt-1 font-mono text-xs break-all">{value}</div>
                      </div>
                    {/if}
                  {/each}
                </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Toast for copy notification -->
{#if showCopiedToast}
  <div class="toast toast-top toast-center" transition:fade>
    <div class="alert alert-success">
      <Check class="w-4 h-4" />
      <span>Copied to clipboard!</span>
    </div>
  </div>
{/if}
