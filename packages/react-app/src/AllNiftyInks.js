import React, { useState, useEffect } from 'react'
import { Avatar, Spin, Button } from 'antd';
import { useEventListener } from "./hooks"
import { getFromIPFS, isBlacklisted } from "./helpers"
import { Loader } from "./components"
import StackGrid from "react-stack-grid";

const MAX_FRONT_PAGE_DISPLAY = 512
const LOADERS_TO_SHOW = 32
const BATCH_DOWNLOAD = 8

export default function NftyWallet(props) {
  //const [allInks, setAllInks] = useState()
  const [allInksArray, setAllInksArray] = useState([])

  let allInkView
  const [lastStreamCount, setLastStreamCount] = useState("0")

  let [inkPage, setInkPage] = useState(0)
  let [lastInkPage, setLastInkPage] = useState(0)
  let inksPerPage = 40
  let [loading, setLoading] = useState(true)

  let inkCreations = useEventListener(props.readKovanContracts,'NiftyInk',"newInk",props.kovanProvider, 1)

  useEffect(()=>{
      if(props.tab === props.thisTab && props.readKovanContracts && inkCreations && props.totalInks && inkCreations.length) {
      if(inkCreations.length.toString() === props.totalInks.toString() && (inkPage !== lastInkPage || props.totalInks.toString() !== lastStreamCount)
      ) {
        setLoading(true)
        let allInks
        if(inkPage === 0) {
          allInks = new Array(Math.min(LOADERS_TO_SHOW, props.totalInks.toString())).fill({})
        } else { allInks = Array.from(allInksArray) }
        setLastStreamCount(props.totalInks.toString())
        setLastInkPage(inkPage)

        const getInkImages = async (e) => {
          const jsonContent = await getFromIPFS(e['jsonUrl'], props.ipfsConfig)
          const inkJson = JSON.parse(jsonContent)
          const inkImageHash = inkJson.image.split('/').pop()
          const imageContent = await getFromIPFS(inkImageHash, props.ipfsConfig)
          const inkImageURI = 'data:image/png;base64,' + imageContent.toString('base64')
          return Object.assign({image: inkImageURI, name: inkJson.name, url: inkJson.drawing}, e);
        }

        const loadStream = async () => {
          if(inkCreations) {

            let allInksToDisplay = ([...Array(props.totalInks.toNumber()).keys()])
            let pageOfInks = allInksToDisplay.reverse().slice(inkPage * inksPerPage, inkPage * inksPerPage + inksPerPage)

            console.log(pageOfInks)

            let mostRecentInks = inkCreations
            let promises = []
            let hashesForDebugging = []
            let skips = 0
            let newIndex = inkPage===0?0:allInks.length
            console.log('newIndex', newIndex)
            for(let i of pageOfInks){
              if(!isBlacklisted(mostRecentInks[i]['jsonUrl'])){
                try {
                  promises.push(getInkImages(mostRecentInks[i]))
                  hashesForDebugging.push(mostRecentInks[i]['jsonUrl'])
                } catch (e) {console.log("EEEERRRRR",e)}
              }else{
                skips++
              }
              if(promises.length>=BATCH_DOWNLOAD){
                for(var p = 0; p <= (promises.length-skips); p++){
                  let result
                  try {
                    result = await promises[p]
                    if(result){
                      //let thisIndex = i-(promises.length-1)+p-skips
                      //console.log("thisIndex",thisIndex)
                      allInks[newIndex++] = result
                      setAllInksArray(allInks)
                    }
                  } catch (e) {console.log("FAILED TO LOAD FROM IPFS =====>",hashesForDebugging[p])}
                }
                promises = []
                hashesForDebugging = []
                skips = 0
              }
              console.log(allInks)
            }
          }
          console.log(allInks)
          setLoading(false)
        }

        loadStream()
      }
    }
  },[props.tab, props.totalInks, inkPage])

  if(allInksArray && allInksArray.length>0) {
           allInkView = (
             <>
        <StackGrid
           columnWidth={120}
           gutterHeight={32}
           gutterWidth={32}
         >
          {allInksArray.map(item =>{
            //console.log("item",item)
            return (
              <div key={item['id']} ipfsHash={item['jsonUrl']} style={{cursor:"pointer"}}>
                {item['image']?<img src={item['image']} alt={item['name']} onClick={() => props.showInk(item['url'])} width='120' height='120'/>/*</Badge>*/:<Avatar size={120} style={{ backgroundColor: '#FFFFFF' }} icon={<Spin style={{opacity:0.125}} size="large" />} />}
              </div>
            )
          })}
        </StackGrid>
        {<Button
          onClick={() => {setInkPage(inkPage + 1)}}
          loading={loading}
          disabled={(inkPage * inksPerPage + inksPerPage).toString() >= inkCreations.length}
          >
          {loading?'Loading':(((inkPage * inksPerPage + inksPerPage).toString() < inkCreations.length)?'Show More':allInksArray.length + ' inks')}
        </Button>}
        </>
        )
  } else {
    allInkView = (<Loader/>)
  }

  return allInkView
}
