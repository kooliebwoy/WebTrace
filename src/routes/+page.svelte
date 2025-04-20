<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';
  import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
  import { ExternalLink, ArrowDown, XCircle, CheckCircle, Repeat2 } from '@lucide/svelte';
  import { fly, fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  // Props derived from server (may not update reliably if types are broken)
  let { form }: PageProps = $props(); 
  // Local state for UI
  let url = $state('');
  let isLoading = $state(false);
  let redirectChain = $state<Array<{ from: string; to: string; status: number; headers: Record<string, string> }>>([]);
  let finalUrl = $state('');
  let errorMessage = $state('');
  let finalStatus = $state<number | null>(null); // State for final status code
  let finalHeaders = $state<Record<string, string>>({});
  
  // UI state for details panel
  let selectedStep = $state<number | null>(null); // null means no step selected
  let showDetailsPanel = $state(false);

  // Log the form prop whenever it changes (keep for debugging)
  $effect(() => {
    console.log('[Client Page] Form prop updated:', form); 
  });

  // Helper to add protocol if missing
  function formatUrl(input: string): string {
    input = input.trim();
    // If input has no protocol, add https://
    if (!input.match(/^https?:\/\//i)) {
      return `https://${input}`;
    }
    return input;
  }

  // Enhance callback to manage loading and manually update local state
  const handleSubmit: SubmitFunction = ({ formData }) => {
    // Format URL if needed before submission
    const rawUrl = formData.get('url') as string;
    formData.set('url', formatUrl(rawUrl));
    
    isLoading = true;
    redirectChain = [];
    finalUrl = '';
    errorMessage = '';
    finalStatus = null; // Reset final status

    return async ({ result }: { result: ActionResult }) => {
      console.log('[Client Page] Enhance callback result:', result);
      isLoading = false;
      
      // Reset the details panel when new results arrive
      selectedStep = null;
      showDetailsPanel = false;

      if (result.type === 'success' && result.data) {
        redirectChain = result.data.chain ?? [];
        finalUrl = result.data.final ?? '';
        errorMessage = '';
        finalStatus = typeof result.data.finalStatus === 'number' ? result.data.finalStatus : null;
        finalHeaders = result.data.finalHeaders ?? {};
      } else if (result.type === 'failure' && result.data) {
        errorMessage = result.data.error ?? 'An unknown error occurred.';
        redirectChain = [];
        finalUrl = '';
        finalStatus = typeof result.data.finalStatus === 'number' ? result.data.finalStatus : 0;
        finalHeaders = {};
      }
    };
  };
  
  // Handle clicking on a step in the redirect chain
  function selectStep(index: number | null) {
    // If clicking the same step, toggle the panel off
    if (selectedStep === index) {
      selectedStep = null;
      showDetailsPanel = false;
      return;
    }
    
    // Otherwise, show details for the selected step
    selectedStep = index;
    showDetailsPanel = true;
  }
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6">
  <!-- Hero Section with Card - transitions on selection -->
  <div class="w-full max-w-6xl flex flex-col md:flex-row items-start justify-center gap-8 transition-all duration-500"
      class:md:justify-start={showDetailsPanel}
      class:md:gap-4={showDetailsPanel}>
    
    <!-- Input Card - Centered when no results, shifts left when results appear -->
    <div class="card w-full md:w-96 bg-base-100 shadow-xl overflow-hidden transition-all duration-500"
         class:mx-auto={!finalUrl || isLoading}
         class:md:ml-0={finalUrl && !isLoading}
         in:fade={{duration: 300}}>
      
      <!-- Card Header -->
      <div class="bg-primary text-primary-content p-5">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Redirect Checker
        </h2>
        <p class="text-sm opacity-80 mt-1">Track the redirection path of any domain</p>
      </div>
      
      <!-- Card Body -->
      <div class="card-body p-6">
        <form method="post" action="?/redirectCheck" class="flex flex-col gap-4" use:enhance={handleSubmit}>
          <div class="form-control">
            <label class="label pb-1">
              <span class="label-text font-medium">Domain or URL</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                class="input input-bordered w-full pr-12 font-mono text-sm" 
                name="url" 
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
            <label class="label pt-0">
              <span class="label-text-alt">No need to add https:// - we'll handle that</span>
            </label>
          </div>
          
          <button 
            class="btn btn-primary w-full mt-2 relative overflow-hidden" 
            type="submit" 
            disabled={isLoading}
          >
            {#if isLoading}
              <div class="absolute inset-0 flex items-center justify-center bg-primary">
                <span class="loading loading-dots"></span>
              </div>
              <span class="opacity-0">Check Redirects</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Check Redirects
            {/if}
          </button>
          
          {#if errorMessage}
            <div class="alert alert-error mt-2 shadow-md" transition:slide>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 stroke-current shrink-0" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{errorMessage}</span>
            </div>
          {/if}
        </form>
      </div>
    </div>

    <!-- Results Chain: Stack from bottom with visual connections -->
    {#if !isLoading && finalUrl}
      <div class="flex-1 flex flex-col justify-start max-w-2xl w-full" 
           transition:fade={{duration: 300, delay: 300}}>
        
        <!-- Chain Header -->
        <h3 class="text-xl font-bold mb-4 mt-2" in:fly={{y: 20, delay: 400, duration: 300}}>
          Redirect Chain
        </h3>
        
        <!-- Timeline track -->
        <div class="relative">
          <!-- Vertical timeline line -->
          <div class="absolute left-7 top-4 bottom-4 w-0.5 bg-primary/30 z-0"></div>
          
          <!-- Chain Steps: Each redirect in sequence -->
          <div class="space-y-6">
            {#each redirectChain as step, i (i)}
              <div class="relative" 
                   in:fly={{y: 40, delay: 500 + (i * 150), duration: 400, easing: quintOut}}>
                <!-- Timeline marker dot -->
                <div class="absolute left-7 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary z-10 shadow-lg"></div>
                
                <!-- Step card - clickable with hover effect -->
                <div class="card bg-base-100 shadow-md hover:shadow-lg ml-12 overflow-hidden transition-all duration-300 cursor-pointer"
                     class:ring-2={selectedStep === i}
                     class:ring-primary={selectedStep === i}
                     onclick={() => selectStep(i)}
                     onkeydown={(e) => e.key === 'Enter' && selectStep(i)}
                     tabindex="0"
                     role="button"
                     aria-pressed={selectedStep === i}>
                  <!-- Status header -->
                  <div class={`p-3 text-white font-semibold ${step.status >= 400 ? 'bg-error' : step.status >= 300 ? 'bg-info' : 'bg-success'}`}>
                    <div class="flex items-center gap-2">
                      {#if step.status >= 400}
                        <XCircle size={18} />
                      {:else if step.status >= 300}
                        <Repeat2 size={18} />
                      {:else}
                        <CheckCircle size={18} />
                      {/if}
                      <span>
                        {step.status >= 400
                          ? `Error: Status Code ${step.status}`
                          : step.status >= 300
                          ? `${step.status} Redirect`
                          : 'Success'}
                      </span>
                    </div>
                  </div>
                  
                  <!-- Card body with URLs -->
                  <div class="p-4">
                    <div class="flex flex-col gap-2">
                      <!-- Source URL -->
                      <div class="flex items-center gap-2">
                        <div class="badge badge-outline">From</div>
                        <a href={step.from} class="font-mono link link-hover text-sm truncate flex items-center gap-1 flex-1" target="_blank">
                          {step.from}
                          <ExternalLink size={14} class="ml-1 opacity-60" />
                        </a>
                      </div>
                      
                      <!-- Target URL (To) -->
                      <div class="flex items-center gap-2">
                        <div class="badge badge-outline">To</div>
                        <a href={step.to} class="font-mono link link-hover text-sm truncate flex items-center gap-1 flex-1" target="_blank">
                          {step.to}
                          <ExternalLink size={14} class="ml-1 opacity-60" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            
            <!-- Final destination -->
            {#if finalUrl}
              <div class="relative" 
                   in:fly={{y: 40, delay: 500 + (redirectChain.length * 150), duration: 400, easing: quintOut}}>
                <!-- Timeline marker dot (final) -->
                <div class="absolute left-7 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-success z-10 shadow-lg ring-2 ring-success ring-offset-2"></div>
                
                <!-- Final destination card - also clickable -->
              <div class="card bg-base-100 shadow-md hover:shadow-lg border-success/30 border ml-12 overflow-hidden transition-all duration-300 cursor-pointer"
                   class:ring-2={selectedStep === -1}
                   class:ring-success={selectedStep === -1}
                   onclick={() => selectStep(-1)}
                   onkeydown={(e) => e.key === 'Enter' && selectStep(-1)}
                   tabindex="0"
                   role="button"
                   aria-pressed={selectedStep === -1}>
                <!-- Status header -->
                <div class="p-3 bg-success text-white font-semibold">
                  <div class="flex items-center gap-2">
                    <CheckCircle size={18} />
                    <span>
                      Final Destination 
                      {#if finalStatus !== null}
                        <span class="badge badge-sm ml-2">{finalStatus}</span>
                      {/if}
                    </span>
                  </div>
                </div>
                
                <!-- Card body with URL -->
                <div class="p-4">
                  <a href={finalUrl} class="font-mono link link-hover text-sm break-all flex items-start gap-1" 
                     target="_blank"
                     onclick={(e) => e.stopPropagation()}>
                    {finalUrl}
                    <ExternalLink size={14} class="ml-1 opacity-60 mt-1 flex-shrink-0" />
                  </a>
                </div>
              </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Details Panel - slides in from right when a step is selected -->
      {#if showDetailsPanel && selectedStep !== null}
        <div 
          class="w-full md:w-96 card bg-base-100 shadow-xl overflow-hidden flex-shrink-0 transition-all duration-500 p-0"
          in:fly={{x: 200, duration: 400, delay: 100}}
          out:fly={{x: 200, duration: 300}}
        >
          <div class="card-body p-0">
            <!-- Panel Header-->
            <div class="bg-neutral text-neutral-content p-4 flex justify-between items-center">
              <h3 class="text-lg font-bold">
                {#if selectedStep === -1}
                  Final Destination
                {:else}
                  Redirect #{selectedStep + 1}
                {/if}
              </h3>
              <button 
                class="btn btn-circle btn-sm" 
                onclick={() => { showDetailsPanel = false; selectedStep = null; }}
                aria-label="Close details panel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <!-- Request Details -->
            <div class="p-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
              <!-- URL Information -->
              <div class="mb-6">
                <h4 class="font-bold text-sm uppercase opacity-60 mb-2">URL</h4>
                <div class="font-mono text-sm break-all bg-base-200 p-3 rounded">
                  {selectedStep === -1 ? finalUrl : redirectChain[selectedStep].from}
                </div>
                
                {#if selectedStep !== -1}
                  <div class="flex justify-center my-2">
                    <ArrowDown size={16} />
                  </div>
                  <div class="font-mono text-sm break-all bg-base-200 p-3 rounded">
                    {redirectChain[selectedStep].to}
                  </div>
                {/if}
              </div>
              
              <!-- Status Code -->
              <div class="mb-6">
                <h4 class="font-bold text-sm uppercase opacity-60 mb-2">Status</h4>
                <div class="text-sm">
                  <span class={`badge ${selectedStep === -1 ? 'badge-success' : 
                      (redirectChain[selectedStep]?.status >= 400 ? 'badge-error' : 
                      redirectChain[selectedStep]?.status >= 300 ? 'badge-info' : 'badge-success')}`}>
                    {selectedStep === -1 ? finalStatus : redirectChain[selectedStep]?.status}
                  </span>
                  <span class="ml-2">
                    {#if selectedStep === -1}
                      Final Response
                    {:else if redirectChain[selectedStep]?.status >= 300 && redirectChain[selectedStep]?.status < 400}
                      Redirect
                    {:else if redirectChain[selectedStep]?.status >= 400}
                      Error
                    {:else}
                      Success
                    {/if}
                  </span>
                </div>
              </div>
              
              <!-- Headers -->
              <div>
                <h4 class="font-bold text-sm uppercase opacity-60 mb-2">Response Headers</h4>
                <div class="overflow-x-auto">
                  <table class="table table-xs">
                    <thead>
                      <tr>
                        <th>Header</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#if selectedStep === -1}
                        {#each Object.entries(finalHeaders) as [key, value]}
                          <tr>
                            <td class="font-mono">{key}</td>
                            <td class="font-mono text-xs break-all max-w-[15rem]">{value}</td>
                          </tr>
                        {/each}
                      {:else if redirectChain[selectedStep]?.headers}
                        {#each Object.entries(redirectChain[selectedStep].headers) as [key, value]}
                          <tr>
                            <td class="font-mono">{key}</td>
                            <td class="font-mono text-xs break-all max-w-[15rem]">{value}</td>
                          </tr>
                        {/each}
                      {/if}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>