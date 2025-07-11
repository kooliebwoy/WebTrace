<script lang="ts">
	import { Chart, BarController, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PieController, ArcElement } from 'chart.js';
	import type { ChartData, ChartOptions, ChartType } from 'chart.js';

	Chart.register(BarController, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PieController, ArcElement);

	let { type = 'bar', data, options }: { type: ChartType, data: ChartData, options: ChartOptions } = $props();
	let canvasElement: HTMLCanvasElement;
	let chart: Chart;

	$effect(() => {
		if (chart) {
			chart.destroy();
		}
		if (canvasElement) {
			chart = new Chart(canvasElement, {
				type: type,
				data: data,
				options: options
			});
		}
	});

	$effect(() => {
		if (chart) {
			chart.data = data;
			chart.update();
		}
	});
</script>

<canvas bind:this={canvasElement}></canvas>
