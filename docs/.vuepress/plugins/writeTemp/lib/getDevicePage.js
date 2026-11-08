const fs = require('fs')
const path = require('path')
const iosList = require('../../../../../grabData/ios')
const jbList = require('../../../../../grabData/jailbreak')
const deviceList = require('../../../../../grabData/deviceList')
const deviceFilterGroups = require('../../../../../appledb/appledb-web/deviceFilterGroups.json')

const hasJbArr = [
    'Apple TV Software',
    'audioOS',
    'bridgeOS',
    'iPhone Software',
    'iPhone OS',
    'iOS',
    'iPadOS',
    'HomePod Software',
    'tvOS',
    'watchOS'
]
const hasJbSet = new Set(hasJbArr)

const devTypeCache = new Map()
function getDevType(type) {
    if (devTypeCache.has(type)) return devTypeCache.get(type)
    let label = type
    for (const devType of deviceFilterGroups) {
        if (devType.types.includes(type)) {
            label = devType.label
            break
        }
    }
    devTypeCache.set(type, label)
    return label
}

function deviceMapKeys(deviceMap) {
    if (!deviceMap) return []
    return Array.isArray(deviceMap) ? deviceMap : Object.keys(deviceMap)
}

function flattenDevices(devices) {
    const out = []
    const stack = Array.isArray(devices) ? devices.slice() : (devices ? [devices] : [])
    while (stack.length) {
        const item = stack.pop()
        if (Array.isArray(item)) stack.push(...item)
        else if (item) out.push(item)
    }
    return out
}

const jbByBuild = new Map()
for (const jb of jbList) {
    if (!jb.compatibility) continue
    for (const entry of jb.compatibility) {
        const devices = flattenDevices(entry.devices)
        for (const build of entry.firmwares || []) {
            let list = jbByBuild.get(build)
            if (!list) {
                list = []
                jbByBuild.set(build, list)
            }
            list.push({ name: jb.name, devices })
        }
    }
}

function activeUrl(source) {
    if (!source || !source.links) return null
    for (const link of source.links) {
        if (link && link.active && link.url) return link.url
    }
    return null
}

const detailCache = new Map()
function firmwareDetail(fw) {
    const id = `${fw.osStr}\0${fw.uniqueBuild}`
    const cached = detailCache.get(id)
    if (cached) return cached

    function collect(propertyName) {
        if (!fw.sources) return []
        const deviceUrl = new Map()
        const order = []
        for (const source of fw.sources) {
            if (source.type != propertyName) continue
            const url = activeUrl(source)
            if (!url) continue
            for (const key of deviceMapKeys(source.deviceMap)) {
                if (deviceUrl.has(key) || !deviceList[key]) continue
                deviceUrl.set(key, url)
                order.push(key)
            }
        }
        const byUrl = new Map()
        for (const key of order) {
            const url = deviceUrl.get(key)
            let group = byUrl.get(url)
            if (!group) {
                group = { url, links: [] }
                byUrl.set(url, group)
            }
            group.links.push({ key, deviceName: deviceList[key].name })
        }
        return Array.from(byUrl.values())
    }

    const onFirmware = new Set(deviceMapKeys(fw.deviceMap))
    const jailbreaks = []
    const seenJb = new Set()
    if (hasJbSet.has(fw.osStr) && fw.build && jbByBuild.has(fw.build)) {
        for (const entry of jbByBuild.get(fw.build)) {
            if (seenJb.has(entry.name)) continue
            const devices = []
            for (const key of entry.devices) if (onFirmware.has(key)) devices.push(key)
            if (!devices.length) continue
            seenJb.add(entry.name)
            jailbreaks.push({ name: entry.name, devices })
        }
    }

    const detail = {
        filteredDownloads: collect('ipsw'),
        filteredOtas: collect('ota'),
        jailbreaks
    }
    detailCache.set(id, detail)
    return detail
}

function linksForPage(groups, devKeySet) {
    const out = []
    for (const group of groups) {
        let first = null
        for (const link of group.links) {
            if (devKeySet.has(link.key)) {
                first = link
                break
            }
        }
        if (!first) continue
        out.push({ url: group.url, deviceName: first.deviceName, key: first.key })
    }
    return out
}

function jailbreakNamesForPage(jailbreaks, devKeySet) {
    const names = []
    for (const jb of jailbreaks) {
        for (const key of jb.devices) {
            if (devKeySet.has(key)) {
                names.push(jb.name)
                break
            }
        }
    }
    return names
}

const dateOffset = (new Date().getTimezoneOffset() * 60 * 1000) + (60 * 60000)
const releasedFormatters = [
    new Intl.DateTimeFormat('en-US', { year: 'numeric' }),
    new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }),
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
]
function formatReleased(released) {
    if (!released) return undefined
    const parts = released.split('-').length
    const adjusted = new Date(Date.parse(released) + dateOffset)
    return releasedFormatters[Math.min(Math.max(parts, 1), 3) - 1].format(adjusted)
}

const detailDir = path.resolve('docs/.vuepress/public/pageData/firmware-detail')
const indexDir = path.resolve('docs/.vuepress/public/pageData/firmware-index')
const writtenDetails = new Set()
let detailDirReady = false

function detailFileName(fw) {
    return `${fw.osStr}__${fw.uniqueBuild}`.replace(/[^A-Za-z0-9._-]+/g, '-') + '.json'
}

function writeDetailOnce(fw, detail) {
    const name = detailFileName(fw)
    if (!writtenDetails.has(name)) {
        if (!detailDirReady) {
            fs.mkdirSync(detailDir, { recursive: true })
            detailDirReady = true
        }
        fs.writeFileSync(path.join(detailDir, name), JSON.stringify(detail))
        writtenDetails.add(name)
    }
    return `/pageData/firmware-detail/${name}`
}

function chartSlug(pagePath) {
    return pagePath.replace(/^\//, '').replace(/\.html$/, '').replace(/\//g, '__') || 'firmware'
}

module.exports = function(args) {
    if (!Array.isArray(args.devArr)) args.devArr = [args.devArr]
    const devArr = args.devArr.filter(x => x && x.key)
    const devImg = (devArr.filter(x => x.hasImage) || devArr)[0]
    const name = args.name
    const devPath = encodeURI(args.path)
    const description = args.description
    const grouped = args.grouped
    const mainList = args.mainList
    const hideChildren = args.hideChildren
    const show = args.show
    const subgroups = args.subgroups || []
    const osStrArr = args.osStrArr || []
    const allDevices = !!args.allDevices
    let groupImg = []
    if (grouped && !mainList) {
        groupImg = devArr.filter(x => x.hasImage && (args.imageKey == x.key || !args.imageKey)).map(x => x.img)
    }

    const devKeySet = new Set(devArr.map(x => x.key))
    const devByKey = new Map(devArr.map(x => [x.key, x]))

    let devFwArr = iosList
    if (!mainList) {
        devFwArr = iosList.filter(fw => {
            for (const key of deviceMapKeys(fw.deviceMap)) if (devKeySet.has(key)) return true
            return false
        })
    }
    if (osStrArr.length) {
        const osSet = new Set(osStrArr)
        devFwArr = devFwArr.filter(fw => osSet.has(fw.osStr))
    }

    const duplicateVersions = new Set()
    const seenVersions = new Set()
    for (const fw of devFwArr) {
        const key = `${fw.osStr}\0${fw.version}`
        if (seenVersions.has(key)) duplicateVersions.add(key)
        else seenVersions.add(key)
    }

    const osStrSeen = []
    const osStrSeenSet = new Set()

    let getVersionArr = devFwArr.map(fw => {
        const devIdFwArr = []
        for (const key of deviceMapKeys(fw.deviceMap)) if (devKeySet.has(key)) devIdFwArr.push(key)
        const devIdSet = new Set(devIdFwArr)

        const devTypeArr = []
        const typeSeen = new Set()
        for (const key of devIdFwArr) {
            const dev = devByKey.get(key)
            if (!dev) continue
            const label = getDevType(dev.type)
            if (typeSeen.has(label)) continue
            typeSeen.add(label)
            devTypeArr.push(label)
        }

        let preinstalledOnDevice = false
        let fullyPreinstalled = devIdFwArr.length > 0
        if (Array.isArray(fw.preinstalled)) {
            const preSet = new Set(fw.preinstalled)
            for (const key of devIdFwArr) {
                if (preSet.has(key)) preinstalledOnDevice = true
                else fullyPreinstalled = false
            }
            if (!preinstalledOnDevice) fullyPreinstalled = false
        } else if (fw.preinstalled) {
            preinstalledOnDevice = devIdFwArr.length > 0
            fullyPreinstalled = preinstalledOnDevice
        } else {
            fullyPreinstalled = false
        }

        let signed = false
        if (Array.isArray(fw.signed)) {
            for (const key of fw.signed) if (devIdSet.has(key)) { signed = true; break }
        } else if (fw.signed) {
            signed = devIdFwArr.length > 0
        }

        let checkSigning = false
        if (Array.isArray(fw.showSigning)) {
            for (const key of fw.showSigning) if (devIdSet.has(key)) { checkSigning = true; break }
        } else {
            checkSigning = !!fw.showSigning
        }

        const detail = firmwareDetail(fw)
        const flatDownloads = linksForPage(detail.filteredDownloads, devIdSet)
        const flatOtas = linksForPage(detail.filteredOtas, devIdSet)
        const jailbreakArr = jailbreakNamesForPage(detail.jailbreaks, devIdSet)

        let detailUrl
        if (mainList && (flatDownloads.length || flatOtas.length || jailbreakArr.length || detail.filteredDownloads.length || detail.filteredOtas.length || detail.jailbreaks.length)) {
            detailUrl = writeDetailOnce(fw, detail)
        }

        const osStrSuffix = (fw.osStr == 'Safari' && fw.osMap) ? ` (${fw.osMap.join(', ')})` : ''
        const osStr = `${fw.osStr}${osStrSuffix}`
        if (!osStrSeenSet.has(osStr)) {
            osStrSeenSet.add(osStr)
            osStrSeen.push(osStr)
        }

        const row = {
            osStr,
            version: fw.version,
            url: `/firmware/${fw.osStr.replace(/ /g, '-')}/${fw.uniqueBuild}.html`,
            deviceFilterArr: mainList ? devTypeArr : devIdFwArr,
            released: fw.released,
            fullyPreinstalled
        }
        if (fw.build) row.build = fw.build
        if (fw.uniqueBuild) row.uniqueBuild = fw.uniqueBuild
        if (duplicateVersions.has(`${fw.osStr}\0${fw.version}`)) row.duplicateVersion = true
        const releasedStr = formatReleased(fw.released)
        if (releasedStr) row.releasedStr = releasedStr
        if (fw.beta) row.beta = true
        if (fw.rc) row.rc = true
        if (fw.internal) row.internal = true
        if (fw.rsr) row.rsr = true
        if (fw.bsi) row.bsi = true
        if (signed) row.signed = true
        if (checkSigning) row.checkSigning = true
        if (preinstalledOnDevice) row.preinstalledOnDevice = true
        if (flatDownloads.length || flatOtas.length) row.hasDownload = true
        if (!mainList) {
            if (flatDownloads.length) row.filteredDownloads = flatDownloads
            if (flatOtas.length) row.filteredOtas = flatOtas
            if (jailbreakArr.length) row.jailbreakArr = jailbreakArr
        } else if (detailUrl && (flatDownloads.length || flatOtas.length || jailbreakArr.length)) {
            row.detailUrl = detailUrl
        }
        return row
    })

    const head = (mainList || !devImg || !devImg.hasImage) ? [] : [
        [
        "meta",
        {
            property: "og:image",
            content: `https://img.appledb.dev/device@256/${devImg.imageKey}/${devImg.img.images[0].id}.png`
        }
        ]
    ]

    const propertyArr = ['name','identifier','appLink','key','released','discontinued','soc','arch','model','board','type','colors','img']
    const linkableArr = ['appLink']
    const infoArr = mainList ? [] : devArr.map(x => {
        var o = {}
        for (const p of propertyArr)
            if (x[p])
                if (linkableArr.includes(p) && typeof x[p] === 'string')
                    o[p] = {
                        'url': x[p],
                        'active': true
                    }
                else o[p] = x[p]
        if (o.colors) o.colors = o.colors.map(y => {
            y.key = y.key || y.name
            return y
        })
        return o
    })

    var extraInfo = undefined

    let img = devImg ? devImg.img : { key: 'logo', images: [{'id': 0, 'dark': true}] }

    var imgCount = 0
    try {
        imgCount = fs.readdirSync(`docs/.vuepress/public/assets/images/device@256/${devArr[0].key}/`).length
    } catch {
        imgCount = 0
    }

    getVersionArr = getVersionArr.reverse().sort((a, b) => {
        const timeA = a.released ? Date.parse(a.released) : 0
        const timeB = b.released ? Date.parse(b.released) : 0
        if (timeA < timeB) return 1
        if (timeA > timeB) return -1
        const osA = a.osStr.toLowerCase()
        const osB = b.osStr.toLowerCase()
        if (osA < osB) return -1
        if (osA > osB) return 1
        return 0
    })

    if (!mainList) {
        getVersionArr.sort((a, b) => {
            if (a.fullyPreinstalled == b.fullyPreinstalled) return 0
            return a.fullyPreinstalled ? 1 : -1
        })
    }

    for (const row of getVersionArr) {
        delete row.released
        delete row.fullyPreinstalled
    }

    const hasFirmwares = {
        release: getVersionArr.some(x => !(x.beta || x.rc || x.internal)),
        beta: getVersionArr.some(x => x.beta || x.rc),
        internal: getVersionArr.some(x => x.internal)
    }

    const hasFirmwareFilters = Object.keys(hasFirmwares).filter(x => hasFirmwares[x]).length > 1

    let firmwareIndex
    if (mainList) {
        fs.mkdirSync(indexDir, { recursive: true })
        const slug = chartSlug(devPath)
        firmwareIndex = `/pageData/firmware-index/${slug}.json`
        fs.writeFileSync(path.join(indexDir, `${slug}.json`), JSON.stringify(getVersionArr))
    }

    let jbCount = 0
    if (!mainList) {
        for (const row of getVersionArr) jbCount += row.jailbreakArr ? row.jailbreakArr.length : 0
    }

    return {
        path: devPath,
        noAds: true,
        frontmatter: {
            title: name,
            hideTitle: !mainList,
            description: description || `Information lookup for ${name}`,
            chartType: 'device',
            widePage: false,
            device: infoArr,
            versionArr: mainList ? [] : getVersionArr,
            firmwareIndex: firmwareIndex,
            deviceKeys: (mainList && !allDevices) ? devArr.map(x => x.key) : undefined,
            hasFirmwares: hasFirmwares,
            hasFirmwareFilters: hasFirmwareFilters,
            grouped: grouped,
            groupImg: groupImg,
            subgroups: subgroups.map(sg => {
                let devArr = infoArr.filter(d => sg.devices.includes(d.key))
                let subgroupImg = devArr.map(x => x.img)

                return {
                    name: sg.name,
                    identifier: devArr.map(x => x.identifier).flat().flat(),
                    subgroup: true,
                    key: sg.groupKey,
                    deviceKeys: sg.devices,
                    released: devArr[0].released,
                    soc: devArr[0].soc,
                    arch: devArr[0].arch,
                    model: devArr.map(x => x.model).flat().flat(),
                    board: devArr.map(x => x.board).flat().flat(),
                    type: sg.type,
                    colors: devArr.map(x => x.colors || []).flat().flat(),
                    img: devArr[0].img,
                    groupImg: subgroupImg
                }
            }),
            hideChildren: hideChildren,
            imgCount: imgCount,
            mainList: mainList,
            show: show || {
                releaseType: hasFirmwareFilters ? [ 'release' ] : Object.keys(hasFirmwares).find(x => hasFirmwares[x])
            },
            noJb: (!(osStrSeen.some(r => hasJbSet.has(r))) && !mainList),
            jbCount: jbCount,
            img: img,
            extraInfo: extraInfo || undefined,
            deviceFilter: (mainList) ?
                Array.from(new Set(devArr.map(x => getDevType(x.type)))).sort((a, b) => a.localeCompare(b)).map(x => {
                    return {
                        label: x,
                        value: x
                    }
                }) :
                devArr.map(x => {
                    return {
                        label: x.name,
                        value: x.key
                    }
                }),

            head: head,

            sidebar: false,
            editLink: false,
            lastUpdated: false,
            contributors: false
        }
    }
}
