<template>
    <h5 v-if="!mainList" style="margin-bottom: .3em;">
        {{ versionHeaderStr }}
        <i
            v-if="!hasFirmwareFilters"
            class="fas fa-sort"
            style="
                margin-inline: 10px;
                font-size: 1em;
                cursor: pointer;
            " @click="versionArr.reverse()"
        ></i>
    </h5>

    <div class="optionsWrapper" v-if="hasFirmwareFilters">
        <div
                :class="[options.showRelease ? 'active' : '', 'release', 'btn','sbiFilter']"
                @click="options.showRelease = !options.showRelease; filterVersions()"
                v-if="hasFirmwares.release"
        >
            <i class="fas fa-circle release"></i> Release
        </div>
        <div
            :class="[options.showBeta ? 'active' : '', 'beta', 'btn','sbiFilter']"
            @click="options.showBeta = !options.showBeta; filterVersions()"
            v-if="hasFirmwares.beta"
        >
            <i class="fas fa-circle beta"></i> Beta
        </div>
        <div
            :class="[options.showInternal ? 'active' : '', 'internal', 'btn','sbiFilter']"
            @click="options.showInternal = !options.showInternal; filterVersions()"
            v-if="hasFirmwares.internal"
        >
            <i class="fas fa-circle internal"></i> Internal
        </div>
        <div class="separatorBefore"></div>
        <div :class="['hoverOn',deviceFilter.length < 2 ? 'show740' : '']">
            <div
                class="btn"
            >
                <i class="fas fa-filter"></i> Filter
            </div>
            <div class="hoverElement filterList">
                <div
                    v-for="filter in [
                        {
                            label: 'Release',
                            option: 'showRelease'
                        },
                        {
                            label: 'Beta',
                            option: 'showBeta'
                        },
                        {
                            label: 'Internal',
                            option: 'showInternal'
                        }
                    ]"
                    :key="filter"
                    :class="[
                        'filterListItem',
                        'show740',
                        options[filter.option] ? 'active' : ''
                    ]"
                    @click="options[filter.option] = !options[filter.option]; filterVersions()"
                >
                    <div :class="['iconWrapper',filter.option]"><i class="fas fa-check"></i></div>
                    <div class="textWrapper">{{ filter.label }}</div>
                </div>
                <template v-if="deviceFilter.length > 1">
                    <hr class="show740">
                    <template v-if="deviceFilter.length > 4">
                        <div
                            class="filterListItem active"
                            @click="options.filterDev.length == deviceFilter.length ?
                                options.filterDev = [] :
                                options.filterDev = deviceFilter.map(x => x.value)
                            ;filterVersions()"
                        >
                            <div class="iconWrapper noBorder"><i :class="`fas fa-border-${options.filterDev.length == deviceFilter.length ? 'none' : 'all'}`"></i></div>
                            <div class="textWrapper">{{ options.filterDev.length == deviceFilter.length ? 'Clear' : 'Select' }} all</div>
                        </div>
                    </template>
                    <div
                        v-for="filter in deviceFilter"
                        :key="filter"
                        :class="[
                            'filterListItem',
                            options.filterDev.includes(filter.value) ? 'active' : ''
                        ]"
                        v-on:click="
                        options.filterDev = options.filterDev.includes(filter.value) ?
                            options.filterDev.filter(x => x != filter.value) :
                            options.filterDev.concat(filter.value);
                        filterVersions()
                    ">
                        <div class="iconWrapper"><i class="fas fa-check"></i></div>
                        <div class="textWrapper">{{ filter.label }}</div>
                    </div>
                </template>
            </div>
        </div>
        <div class="separatorAfter"></div>
        <div
            @click="versionArr.reverse()"
            class="btn"
        >
            <i class="fas fa-sort"></i> Sort
        </div>
        <div
            @click="$refs.fwSearchBar.focus()"
            class="btn searchBtn"
        >
            <i class="fas fa-search"></i> <input
                class="search"
                v-model="options.searchStr"
                placeholder="Search"
                aria-placeholder="Search"
                v-on:keyup.enter="filterVersions()"
                ref="fwSearchBar"
            >
        </div>
    </div>

    <div v-if="options.showFilter" class="optionsWrapper filterListHorizontal">
        <template v-if="deviceFilter.length > 4">
            <div class="btn" @click="options.filterDev = []; filterVersions()">
                <i class="fas fa-times" style="font-size: .8em; margin-right: 4px;"></i> Clear all
            </div>
            <div class="btn" @click="options.filterDev = deviceFilter.map(x => x.value); filterVersions()">
                <i class="fas fa-check" style="font-size: .8em; margin-right: 4px;"></i> Select all
            </div>
            <div style="border-right: 1px solid var(--c-border); margin-inline: .5em; margin-block: .4em;"></div>
        </template>
        <div
            v-for="filter in deviceFilter"
            :key="filter"
            :class="[
                'filterBtn',
                'btn',
                options.filterDev.includes(filter.value) ? 'active' : ''
            ]"
            @click="
            options.filterDev = options.filterDev.includes(filter.value) ?
                options.filterDev.filter(x => x != filter.value) :
                options.filterDev.concat(filter.value);
            filterVersions()
        ">
            <span>{{ filter.label }}</span>
        </div>
    </div>

    <div v-if="loadError" style="padding: 1em;">{{ loadError }}</div>
    <div v-else-if="firmwareIndex && !ready" style="padding: 1em;">Loading firmware…</div>
    <div v-else ref="list">
        <div :style="{ height: windowRange.padTop + 'px' }"></div>
        <div
            v-for="item in visibleRows"
            :key="item.fw.url || item.index"
            :data-i="item.index"
            ref="rows"
        >
            <firmwareVersionTableElement
                :fw="item.fw"
                :options="options"
                :showDots="(options.showRelease + options.showBeta + options.showInternal > 1) && hasFirmwareFilters"
                :hasFirmwares="hasFirmwares"
                :showSingleDownloads="showSingleDownloads"
                :deviceKeySet="deviceKeySet"
            />
        </div>
        <div :style="{ height: windowRange.padBottom + 'px' }"></div>
    </div>

    <div v-if="ready && !loadError" style="display: flex; padding: 1em; padding-top: 1.5em;">
        <div>Showing {{ versionArr.length }} firmware versions.</div>
    </div>

    <hiddenOptions
        v-if="devOptions.show"
        :options="options"
        :optionsObj="optionsObj"
        :devOptions="devOptions"
        :deviceFilter="deviceFilter"
        :filterVersions="filterVersions"
    />
</template>

<script>
import { markRaw } from 'vue'
import { siteUrl } from '../../siteUrl.js'

const ROW_ESTIMATE = 68

export default {
    props: {
        fmVersionArr: Array,
        firmwareIndex: String,
        deviceKeys: Array,
        deviceFilter: Array,
        mainList: Boolean,
        hasFirmwares: Object,
        hasFirmwareFilters: Boolean,
        show: Object,
        devOptions: Object
    },
    data() {
        return {
            ready: false,
            loadError: '',
            versionArr: [],
            scrollY: 0,
            listTop: 0,
            viewportH: 800,
            prefixVersion: 0,

            versionHeaderStr: 'Firmware Versions',

            optionsObjStr: {
                showBuildNumber: "Show build numbers",
                showVersionString: "Show version numbers",
                showReleasedString: "Show release dates",
                showSigningStatus: "Show signing status",
                showTweetButton: "Show Tweet button"
            },

            options: {
                showBuildNumber: false,
                showVersionString: true,
                showReleasedString: true,
                showSigningStatus: true,

                showRelease: true,
                showBeta: false,
                showInternal: false,

                showTweetButton: false,

                searchStr: '',
                
                showFilter: false,
                filterDev: []
            },
        }
    },
    computed: {
        optionsObj() {
            return [
                "showBuildNumber",
                "showVersionString",
                "showReleasedString",
                "showSigningStatus",
                "showTweetButton"
            ].map(x => {
                return {
                    label: this.optionsObjStr[x],
                    model: x,
                    display: true
                }
            })
        },
        deviceKeySet() {
            if (!this.deviceKeys || !this.deviceKeys.length) return null
            return new Set(this.deviceKeys)
        },
        showSingleDownloads() {
            const rows = this.versionArr
            for (let i = 0; i < rows.length; i++) {
                const fw = rows[i]
                if (fw.hasDownload || fw.preinstalledOnDevice) return true
            }
            return false
        },
        windowRange() {
            const prefix = this._prefix || [0]
            const n = Math.max(0, prefix.length - 1)
            void this.prefixVersion
            const viewTop = Math.max(0, this.scrollY - this.listTop)
            const viewBottom = viewTop + (this.viewportH || 800)
            const overscan = 800
            const target = Math.max(0, viewTop - overscan)
            const limit = viewBottom + overscan
            let lo = 0
            let hi = n
            while (lo < hi) {
                const mid = (lo + hi) >> 1
                if (prefix[mid] < target) lo = mid + 1
                else hi = mid
            }
            const start = Math.max(0, lo - 1)
            let end = start
            while (end < n && prefix[end] < limit) end++
            end = Math.min(n, Math.max(end, start))
            return {
                start,
                end,
                padTop: prefix[start] || 0,
                padBottom: (prefix[n] || 0) - (prefix[end] || 0)
            }
        },
        visibleRows() {
            const rows = this.versionArr
            const { start, end } = this.windowRange
            const out = []
            for (let i = start; i < end; i++) out.push({ index: i, fw: rows[i] })
            return out
        }
    },
    methods: {
        rebuildPrefix() {
            const rows = this.versionArr || []
            const heights = this._heights || {}
            const prefix = new Array(rows.length + 1)
            prefix[0] = 0
            for (let i = 0; i < rows.length; i++) prefix[i + 1] = prefix[i] + (heights[i] || ROW_ESTIMATE)
            this._prefix = prefix
            this.prefixVersion++
        },
        onScroll() {
            if (this._scrollRaf) return
            this._scrollRaf = requestAnimationFrame(() => {
                this._scrollRaf = 0
                const list = this.$refs.list
                this.viewportH = window.innerHeight
                this.scrollY = window.scrollY || document.documentElement.scrollTop || 0
                if (list) {
                    const rect = list.getBoundingClientRect()
                    this.listTop = rect.top + this.scrollY
                }
            })
        },
        observeRows() {
            if (typeof ResizeObserver === 'undefined') return
            if (!this._ro) {
                this._ro = new ResizeObserver(entries => {
                    let changed = false
                    for (const entry of entries) {
                        const index = Number(entry.target.dataset.i)
                        const height = Math.ceil(entry.target.offsetHeight)
                        if (!height || this._heights[index] === height) continue
                        this._heights[index] = height
                        changed = true
                    }
                    if (!changed) return
                    if (this._prefixRaf) cancelAnimationFrame(this._prefixRaf)
                    this._prefixRaf = requestAnimationFrame(() => this.rebuildPrefix())
                })
            }
            const nodes = this.$refs.rows || []
            const list = Array.isArray(nodes) ? nodes : [nodes]
            for (const el of this._observed || []) this._ro.unobserve(el)
            this._observed = []
            for (const el of list) {
                if (!el) continue
                this._ro.observe(el)
                this._observed.push(el)
            }
        },
        filterVersions() {
            const showRelease = this.options.showRelease
            const showBeta = this.options.showBeta
            const showInternal = this.options.showInternal
            const selected = new Set(this.options.filterDev)
            const query = (this.options.searchStr || '').toLowerCase()
            const source = this._source || []
            const out = []
            for (let i = 0; i < source.length; i++) {
                const fw = source[i]
                const releaseOk = fw.internal ? showInternal : ((fw.beta || fw.rc) ? showBeta : showRelease)
                if (!releaseOk) continue
                const filters = fw.deviceFilterArr || []
                let deviceOk = false
                for (let j = 0; j < filters.length; j++) {
                    if (selected.has(filters[j])) {
                        deviceOk = true
                        break
                    }
                }
                if (!deviceOk) continue
                if (query) {
                    const haystack = `${fw.osStr} ${fw.version} ${fw.build || ''}`.toLowerCase()
                    if (!haystack.includes(query)) continue
                }
                out.push(fw)
            }
            this.versionArr = markRaw(out)
            this._heights = {}
            this.rebuildPrefix()

            let filterValues = [
                ['release',  this.options.showRelease],
                ['beta',    this.options.showBeta],
                ['internal',this.options.showInternal]
            ]

            let filter = filterValues.filter(x => x[1]).map(x => x[0])
            if (filter.length == filterValues.length) filter = []

            if (this.deviceFilter.length != this.options.filterDev.length) {
                filter.push(...this.options.filterDev)
            }

            filter = filter.length ? { filter: filter.join(';') } : {}

            this.$router.push({ query: filter }).catch(() => {})
        },
        applyInitialFilters() {
            let querySet = {
                releaseBetaInternalFilter: false,
                deviceFilter: false
            }

            let query = this.$route.query
            if (query && query.filter && query.filter.length) {
                query = query.filter.split(';')
                if (query.some(r => ['release','beta','internal'].includes(r))) {
                    querySet.releaseBetaInternalFilter = true
                    this.options.showRelease = query.includes('release')
                    this.options.showBeta = query.includes('beta')
                    this.options.showInternal = query.includes('internal')
                }
                if (query.some(r => this.deviceFilter.map(x => x.value).includes(r))) {
                    querySet.deviceFilter = true
                    this.options.filterDev = query.filter(x => this.deviceFilter.map(x => x.value).includes(x))
                }
            }

            if (!querySet.deviceFilter) this.options.filterDev = this.deviceFilter.map(x => x.value)

            if (!querySet.releaseBetaInternalFilter) {
                if (this.show && this.show.releaseType) {
                    this.options.showBeta = this.show.releaseType.includes('beta')
                    this.options.showInternal = this.show.releaseType.includes('internal')
                } else if (!this.hasFirmwareFilters) {
                    this.options.showRelease = this.hasFirmwares.release
                    this.options.showBeta = this.hasFirmwares.beta
                    this.options.showInternal = this.hasFirmwares.internal
                }
            }
        }
    },
    updated() {
        this.observeRows()
    },
    mounted() {
        this._source = []
        this._heights = {}
        this._prefix = [0]
        this._observed = []
        this.applyInitialFilters()
        const start = () => {
            this.filterVersions()
            this.ready = true
            window.addEventListener('scroll', this.onScroll, { passive: true })
            window.addEventListener('resize', this.onScroll, { passive: true })
            this.$nextTick(() => this.onScroll())
        }
        if (this.firmwareIndex) {
            fetch(siteUrl(this.firmwareIndex))
                .then(response => {
                    if (!response.ok) throw new Error(response.status)
                    return response.json()
                })
                .then(rows => {
                    this._source = markRaw(rows)
                    start()
                })
                .catch(() => {
                    this.loadError = 'Could not load the firmware list.'
                    this.ready = true
                })
            return
        }
        this._source = this.fmVersionArr || []
        start()
    },
    beforeUnmount() {
        window.removeEventListener('scroll', this.onScroll)
        window.removeEventListener('resize', this.onScroll)
        if (this._ro) this._ro.disconnect()
        if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf)
        if (this._prefixRaf) cancelAnimationFrame(this._prefixRaf)
    }
}
</script>

<style lang="scss" scoped>
html.dark .btn {
    background: var(--c-border-dark);
}

.optionsWrapper {
    display: flex;
    align-content: space-between;
    flex-flow: row wrap;
    margin-bottom: .5em;

    .separatorBefore {
        margin-inline: auto;
    }
    .separatorAfter {
        margin-inline: 0;
    }

    .search {
        font-size: 1em;
        background: inherit;
        border: none;
        margin: 0;
        padding: 0;
        margin-left: 4px;
        width: 51px;

        &:focus-visible {
            outline: none;

        }
    }

    .btn {
        white-space: nowrap;
        padding: .7em;
        padding-inline: 1.2em;
        margin: .3em;
        border-radius: 4em;
        cursor: pointer;
        transition: 100ms background ease-in-out, transform 150ms ease-in-out;
        border: 1px solid var(--c-border);
        box-shadow: 0px 2px 4px rgba(0,0,0,0.05);

        .fas {
            font-size: .9em;
        }

        &:has(>.search:focus-visible) {
            background: var(--c-border) !important;
        }

        &:hover {
            transform: scale(1.05);
            background: var(--c-border) !important;
        }

        &.active {
            background: var(--c-border);
            font-weight: 600;

            &.release {
                background: #039be530 !important;
                border-color: #039be501 !important;
            }

            &.beta {
                background: #ab47bc30 !important;
                border-color: #ab47bc01 !important;
            }

            &.internal {
                background: #fbc02d30 !important;
                border-color: #fbc02d01 !important;
            }
        }

        &.release {
            background: #039be510 !important;
                border-color: #039be501 !important;
            &:hover {
                background: #039be530 !important;
            }
        }
        &.beta {
            background: #ab47bc10 !important;
            border-color: #ab47bc01 !important;
            &:hover {
                background: #ab47bc30 !important;
            }
        }
        &.internal {
            background: #fbc02d10 !important;
            border-color: #fbc02d01 !important;
            &:hover {
                background: #fbc02d30 !important;
            }
        }

        .fa-circle {
            font-size: .5em;
            vertical-align: middle;
            padding-bottom: 2px;
            padding-right: 4px;
        }

        .release {
            color: #039be5;
        }

        .beta {
            color: #ab47bc;
        }

        .internal {
            color: #fbc02d;
        }
    }
}

.hoverElement {
    opacity: 0;
    transition: opacity 100ms ease-in-out, margin-top 100ms ease-in-out, transform 200ms ease;
    margin-top: -10px;
    transform: scale(0);
    transform-origin: top left;
    position: relative;
    left: calc(calc(calc(100vw - var(--content-width)) / 2) + 416px);
    max-width: calc(var(--content-width) * 0.6);
}

.show740 {
    display: none !important;
}

@media screen and (max-width: 740px) {
    .show740 {
        display: inherit !important;
        
        &.filterListItem {
            display: flex !important;
        }
    }

    .hoverElement {
        left: 2em;
        max-width: 60%;
    }

    .optionsWrapper {
        .sbiFilter {
            display: none;
        }

        .separatorBefore {
            margin-inline: 0;
        }
        .separatorAfter {
            margin-inline: 0;
        }
    }
}


.hoverOn:hover .hoverElement {
    opacity: 1;
    margin-top: 5px;
    transform: scale(1);
}

.filterList {
    position: absolute;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    padding: 1em;
    border-radius: 8px;
}

/*.filterListHorizontal {
    display: flex;
    flex-flow: row nowrap;
    overflow-x: auto;

    padding-bottom: 1em;
    margin-bottom: 0;

    .filterBtn {
        background: var(--c-bg) !important;

        &.active {
            background: var(--c-border) !important;
        }
    }
}*/

.filterListItem {
    padding: .4em;
    display: flex;

    &:hover {
        cursor: pointer;
    }
    
    .iconWrapper {
        opacity: 0.7;
        display: block;
        border: 1px solid;
        border-radius: 4px;
        margin-right: .8em;
        font-size: .6em;

        i {
            opacity: 0;
            padding: 4px;
        }

        &.noBorder {
            i {
                padding-block: 0;
            }

            margin-right: .4em;
            font-size: 1em;
            border: 0px;
        }

        &.showRelease {
            color: #039be5;
            opacity: 1;
        }

        &.showBeta {
            color: #ab47bc;
            opacity: 1;
        }

        &.showInternal {
            color: #fbc02d;
            opacity: 1;
        }
    }

    &.active i {
        opacity: 1;
    }
}
</style>