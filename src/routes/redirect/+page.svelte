<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, fly, slide } from 'svelte/transition';
  import { Repeat2, ExternalLink, ArrowDown, XCircle, CheckCircle, Info, ArrowLeft } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { quintOut } from 'svelte/easing';
  import { browser } from '$app/environment';

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
  let isMobile = $state(false);

  // Check if we're on mobile on client side
  if (browser) {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    
    // Initial check
    checkMobile();
    
    // Setup resize listener
    window.addEventListener('resize', checkMobile);
  }
  
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

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4 sm:p-6">
  <!-- Container with conditional classes for different layouts -->
  <div class="w-full max-w-[95%] 2xl:max-w-[90%] transition-all duration-500"
      class:flex={!finalUrl || isLoading}
      class:flex-col={!finalUrl || isLoading}
      class:items-center={!finalUrl || isLoading}
      class:justify-center={!finalUrl || isLoading}
      class:grid={finalUrl && !isLoading}
      class:grid-cols-1={finalUrl && !isLoading}
      class:md:grid-cols-2={finalUrl && !isLoading && !showDetailsPanel}
      class:md:grid-cols-[auto_1fr]={finalUrl && !isLoading && !showDetailsPanel}
      class:md:grid-cols-1={finalUrl && !isLoading && showDetailsPanel}
      class:lg:grid-cols-3={finalUrl && !isLoading && showDetailsPanel}
      class:lg:grid-cols-[auto_1fr_auto]={finalUrl && !isLoading && showDetailsPanel}
      class:justify-items-center={finalUrl && !isLoading}
      class:gap-6={finalUrl && !isLoading}
      class:lg:gap-10={finalUrl && !isLoading}>
    
    <!-- Input Card - Adaptive dimensions with mobile responsiveness -->
    <div class="card w-[min(350px,95vw)] bg-base-100 shadow-xl transition-all duration-500"
         class:self-start={finalUrl && !isLoading && !isMobile}
         class:self-center={!finalUrl || isLoading || isMobile}
         class:justify-self-center={finalUrl && !isLoading}
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
          
          <div class="mt-2">
            <button 
              type="button" 
              class="btn btn-ghost btn-xs w-full flex justify-center items-center gap-2" 
              onclick={() => goto('/')}
            >
              <ArrowLeft class="w-3 h-3" /> Back to tools
            </button>
          </div>
          
          {#if errorMessage}
            <div class="alert alert-error mt-2 shadow-md" transition:slide>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 stroke-current shrink-0" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{errorMessage}</span>
            </div>
          {/if}
        </form>
      </div>
    </div>

    {#if !isLoading && finalUrl}
      <div class="flex flex-col justify-start h-full w-full max-w-[600px] mx-auto" 
           transition:fade={{duration: 300, delay: 300}}>
        
        <!-- Chain Header -->
        <h3 class="text-xl font-bold mb-4 mt-2" in:fly={{y: 20, delay: 400, duration: 300}}>
          <div class="flex items-center gap-2">
            <Repeat2 class="h-5 w-5" />
            Redirect Chain
          </div>
          <div class="text-sm font-normal opacity-70 mt-1">
            Total: {redirectChain.length} redirect{redirectChain.length !== 1 ? 's' : ''}
          </div>
        </h3>
        
        <div class="relative">
          <!-- Vertical timeline line -->
          <div class="absolute left-7 top-4 bottom-4 w-0.5 bg-primary/30 z-0"></div>
          
          <!-- Chain Steps: Each redirect in sequence -->
          <div class="space-y-6">
            {#each redirectChain as step, i (i)}
              <div class="relative" 
                   in:fly={{y: 40, delay: 500 + (i * 150), duration: 400, easing: quintOut}}>
                <!-- Timeline marker dot -->
                <div class="absolute left-7 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-base-100 shadow-xl ring-2 ring-primary z-10"></div>
                
                <!-- Card -->
                <div class="card bg-base-100 shadow-md rounded-lg ml-14 hover:shadow-lg transition-shadow cursor-pointer"
                     onclick={() => selectStep(i)}
                     class:ring-2={selectedStep === i}
                     class:ring-primary={selectedStep === i}
                     class:ring-offset-2={selectedStep === i}>
                  <div class="card-body p-4">
                    <!-- From URL & Status -->
                    <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span class="badge badge-sm badge-outline">Step {i + 1}</span>
                      {#if step.status}
                        <span class="badge badge-sm" 
                              class:badge-info={step.status >= 300 && step.status < 400}
                              class:badge-success={step.status >= 200 && step.status < 300}
                              class:badge-error={step.status >= 400}>
                          HTTP {step.status}
                        </span>
                      {/if}
                    </div>
                    
                    <!-- Step Domain/URL -->
                    <div class="mt-1">
                      <div class="font-mono text-xs sm:text-sm truncate hover:text-clip">
                        {step.from}
                      </div>
                      
                      <!-- Arrow downward -->
                      <div class="flex justify-center py-1">
                        <ArrowDown class="h-5 w-5 text-primary/70" />
                      </div>
                      
                      <div class="font-mono text-xs sm:text-sm truncate hover:text-clip">
                        {step.to}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            
            {#if finalUrl}
              <div class="relative" 
                   in:fly={{y: 40, delay: 500 + (redirectChain.length * 150), duration: 400, easing: quintOut}}>
                <!-- Timeline marker dot (final) -->
                <div class="absolute left-7 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-success z-10 shadow-lg ring-2 ring-success ring-offset-2"></div>
                
                <!-- Final card -->
                <div class="card bg-base-100 shadow-md rounded-lg ml-14 hover:shadow-lg transition-shadow cursor-pointer"
                     onclick={() => selectStep(redirectChain.length)}
                     class:ring-2={selectedStep === redirectChain.length}
                     class:ring-primary={selectedStep === redirectChain.length}
                     class:ring-offset-2={selectedStep === redirectChain.length}>
                  <div class="card-body p-4">
                    <!-- Final destination header -->
                    <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span class="badge badge-sm badge-outline">Final Destination</span>
                      {#if finalStatus}
                        <span class="badge badge-sm" 
                              class:badge-info={finalStatus >= 300 && finalStatus < 400}
                              class:badge-success={finalStatus >= 200 && finalStatus < 300}
                              class:badge-error={finalStatus >= 400}>
                          HTTP {finalStatus}
                        </span>
                      {/if}
                    </div>
                    
                    <!-- Final URL -->
                    <div class="flex items-center gap-1 mt-1">
                      <div class="font-mono text-xs sm:text-sm truncate hover:text-clip">
                        {finalUrl}
                      </div>
                      <a href={finalUrl} target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-xs btn-circle">
                        <ExternalLink class="h-4 w-4" />
                      </a>
                    </div>
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
          class="h-full w-full max-w-[400px] self-start"
          in:fly={{x: 40, duration: 300}}
          out:fly={{x: 40, duration: 200}}
        >
          <div class="card bg-base-100 shadow-xl h-full sticky top-4">
            <div class="card-body p-5">
              <div class="flex justify-between items-center mb-2">
                <h3 class="card-title text-lg">
                  {#if selectedStep < redirectChain.length}
                    {redirectChain[selectedStep].status >= 300 && redirectChain[selectedStep].status < 400 ? 'Redirect' : 'Response'} Details
                  {:else}
                    Final Response Details
                  {/if}
                </h3>
                <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { selectedStep = null; showDetailsPanel = false; }}>
                  <XCircle class="h-5 w-5" />
                </button>
              </div>
              
              <!-- Header info -->
              <div class="py-2">
                {#if selectedStep < redirectChain.length}
                  <div class="font-medium text-sm opacity-80 mt-2">URL</div>
                  <div class="font-mono text-xs break-all bg-base-200 p-2 rounded mt-1">{redirectChain[selectedStep].from}</div>
                  
                  <div class="flex justify-center py-2">
                    <ArrowDown class="h-5 w-5 text-primary/70" />
                  </div>
                  
                  <div class="font-medium text-sm opacity-80">Redirected To</div>
                  <div class="font-mono text-xs break-all bg-base-200 p-2 rounded mt-1">{redirectChain[selectedStep].to}</div>
                  
                  <div class="flex items-center gap-2 mt-3">
                    <div class="font-medium text-sm opacity-80">Status Code</div>
                    <span class="badge" 
                          class:badge-info={redirectChain[selectedStep].status >= 300 && redirectChain[selectedStep].status < 400}
                          class:badge-success={redirectChain[selectedStep].status >= 200 && redirectChain[selectedStep].status < 300}
                          class:badge-error={redirectChain[selectedStep].status >= 400}>
                      {redirectChain[selectedStep].status}
                    </span>
                  </div>
                  
                  <div class="divider my-3">Headers</div>
                  
                  <div class="overflow-y-auto max-h-[60vh] pr-2">
                    {#each Object.entries(redirectChain[selectedStep].headers) as [key, value]}
                      <div class="mb-3">
                        <div class="font-medium text-xs opacity-80">{key}</div>
                        <div class="font-mono text-xs break-all bg-base-200 p-2 rounded mt-1">{value}</div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <!-- Final destination details -->
                  <div class="font-medium text-sm opacity-80 mt-2">Final URL</div>
                  <div class="font-mono text-xs break-all bg-base-200 p-2 rounded mt-1">{finalUrl}</div>
                  
                  <div class="flex items-center gap-2 mt-3">
                    <div class="font-medium text-sm opacity-80">Status Code</div>
                    <span class="badge" 
                          class:badge-info={finalStatus >= 300 && finalStatus < 400}
                          class:badge-success={finalStatus >= 200 && finalStatus < 300}
                          class:badge-error={finalStatus >= 400}>
                      {finalStatus}
                    </span>
                  </div>
                  
                  <div class="divider my-3">Headers</div>
                  
                  <div class="overflow-y-auto max-h-[60vh] pr-2">
                    {#each Object.entries(finalHeaders) as [key, value]}
                      <div class="mb-3">
                        <div class="font-medium text-xs opacity-80">{key}</div>
                        <div class="font-mono text-xs break-all bg-base-200 p-2 rounded mt-1">{value}</div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
