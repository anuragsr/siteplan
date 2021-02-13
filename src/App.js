import React, { useRef, useState, Suspense } from 'react'
import { extend, Canvas, useFrame, useThree, useLoader } from 'react-three-fiber'
import { Html, OrthographicCamera } from '@react-three/drei'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import * as THREE from 'three'
import Slider from 'rc-slider'
import Switch from 'rc-switch'
import NProgress from 'nprogress'
import assetData from './helpers/assetData'

// Debug
import DatGui, { DatBoolean, DatString } from 'react-dat-gui'
import 'react-dat-gui/dist/index.css'
import FPSStats from 'react-fps-stats'
import { l, point3D, point3DHover } from './helpers/index'

// SCSS
import './scss/app.scss'

// Make OrbitControls known as <orbitControls />
extend({ OrbitControls })

const CameraControls = () => {
  // Get a reference to the Three.js Camera, and the canvas html element.
  // We need these to setup the OrbitControls component.
  const {
    camera,
    gl: { domElement },
    scene
  } = useThree()
  , inspect = () => {
    window.camera = camera
    window.THREE = THREE
    window.scene = scene
  }
  , setControlParams = () => {
    controls.current.minPolarAngle = Math.PI / 4 + .3;
    controls.current.maxPolarAngle = Math.PI / 4 + .5;

    // For Orthographic camera
    controls.current.minZoom = 12;
    controls.current.maxZoom = 24;

    controls.current.enableDamping = true;
    controls.current.dampingFactor = 0.05;
    controls.current.autoRotate = true;
    controls.current.autoRotateSpeed = .2;
    controls.current.enablePan = false;
    controls.current.enableKeys = false;
  }

  // inspect()

  // Ref to the controls, so that we can update them on every frame using useFrame
  const controls = useRef()
  useFrame(() => { controls.current.update()})
  controls.current && setControlParams()

  return <orbitControls ref={controls} args={[camera, domElement]} />
}
, Box = props => {
  // This reference will give us direct access to the mesh
  const mesh = useRef()

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)

  // Rotate mesh every frame, this is outside of React without overhead
  // useFrame(() => {
  //   mesh.current.rotation.x = mesh.current.rotation.y += 0.01
  // })

  return (
    <mesh
        {...props}
        ref={mesh}
        scale={active ? [1.5, 1.5, 1.5] : [1, 1, 1]}
        onClick={(event) => setActive(!active)}
        onPointerOver={(event) => setHover(true)}
        onPointerOut={(event) => setHover(false)}>
      <boxBufferGeometry args={[50, 50, 50]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}
, PointLightWithHelper = ({ color, position, visible, intensity }) => {
  const lightProps = { color, position, intensity }
  return (
    <pointLight {...lightProps}>
      <mesh visible={visible}>
        <sphereBufferGeometry/>
        <meshStandardMaterial color={0x0000ff} />
      </mesh>
    </pointLight>
  )
}
, BuildingMeshGroup = props => {
  const { name, guiData, setGuiData, children, opacity } = props
  return (
    <group {...props}>{
      children.map((child, idx) => {
        return (
          <mesh key={idx} {...child}
            // onPointerOver={(event) => {
            //   // l("over group", event.object.name, event.object.parent.name)
            //   event.stopPropagation()
            //   setGuiData(prev => ({ ...prev, activeObject: event.object.parent.name }))
            // }}
            >
            <meshStandardMaterial {...child.material} transparent opacity={opacity} />
              {/* emissive={guiData.activeObject === name ? 0xff0000 : child.material.origEmissive} /> */}
          </mesh>)
      })
    }</group>
  )
}
, BuildingMesh = props => {
  const { name, guiData, setGuiData, opacity, material } = props
  return (
    <mesh {...props}
      // onPointerOver={(event) => {
      //   // l("over mesh", event.object.name, event.object.name)
      //   event.stopPropagation()
      //   setGuiData(prev => ({ ...prev, activeObject: event.object.name }))
      // }}
      >
      <meshStandardMaterial {...material} transparent opacity={opacity} />
        {/* emissive={guiData.activeObject === name ? 0xff0000 : material.origEmissive} /> */}
    </mesh>
  )
}
, Buildings = props => {
  const { name, url, position, opacity, showLabels, assets, guiData, setGuiData } = props
  , annotationProps = { name: "buildings", position:[0, 0, 0], showLabels, assets, guiData, setGuiData }
  , gltf = useLoader(GLTFLoader, url)

  // l(gltf.scene)
  NProgress.done()
  document.getElementById("enter").classList.add("appear")

  // Set name, original emissive color for highlight
  gltf.scene.name = name
  gltf.scene.children.forEach(child => {
    if (child.type === 'Group'){
      child.children.forEach(subchild => {
        subchild.material.origEmissive = subchild.material.emissive
      })
    } else {
      child.material.origEmissive = child.material.emissive
    }
  })
  
  return (
    <group name={name} position={position}>{gltf.scene.children.map((child, idx) => {
      const childProps = { ...child, opacity, guiData, setGuiData }
      return (
        <React.Fragment key={idx}>
          {child.type === 'Group' && <BuildingMeshGroup {...childProps} />}
          {child.type === 'Mesh' && <BuildingMesh {...childProps} />}            
        </React.Fragment>
      )})}
      <Annotation {...annotationProps} />
    </group>
  )
}
, Ground = ({ name, url, position, opacity }) => {
  const gltf = useLoader(GLTFLoader, url )
  // l(gltf.scene)

  gltf.scene.children.forEach(child => {
    if (child.name === 'ground-map'){
      child.material.opacity = opacity
      child.material.shininess = 0
      child.material.roughness = 100
    }
  })

  return <primitive name={name}
    object={gltf.scene}
    position={position}
    // onPointerOver={() => {
    //   // l("over ground", event.object.name, event.object.parent.name)
    //   setGuiData(prev => ({ ...prev, activeObject: "None" }))
    // }}
    />
}
, Annotation = ({ name, position, assets, showLabels, guiData, setGuiData }) => {
  // l(name, assets, showLabels)
  let className
  switch(name){
    case "buildings": className = "css3D ann-build"; break
    case "temp": className = "css3D ann-temp"; break
    default: className = "css3D ann-react"; break
  }

  return (
    <group position={position}>{showLabels && assets.map((asset, idx) => (
      <Html key={idx} center position={asset.coordinates}>
        <div className={className} id={`ann${idx}`}>
          <div className="pos-relative">
            <div className={`name${asset.mesh === guiData.activeObject ? " active" : ""}`}
              onMouseOver={(event) => {
                // l("over annotation", event, asset)
                event.stopPropagation()
                if (name === "buildings") setGuiData(prev => ({ ...prev, activeObject: asset.mesh }))
              }}
              onMouseOut={() => setGuiData(prev => ({ ...prev, activeObject: "None" }))}
            >{asset.name}</div>
            <div className="ctn-point pos-relative">
              <img src="assets/images/Group 23@1X.png" alt="" />
              <img src="assets/images/Group 27@1X.png" alt="" />
            </div>
            <div className="line"></div>
          </div>
        </div>
      </Html>
    ))}</group>
  )
}

// NProgress.configure({ minimum: .2 })
NProgress.start()

export default function App() {
  const [guiData, setGuiData] = useState({ activeObject: "None", showHelpers: !true })
  , [viewData, setViewData] = useState({
    opacity: 100, greyscale: false, 
    visible: "buildings", toggleOpts: false
  })
  , handleChange = (value, property) => setViewData(prev => ({ ...prev, [property]: value }))
  , showItems = (e, type) => {
    e.preventDefault()
    setViewData(prev => ({ ...prev, visible: type }))
  }
  , { buildings, temp, reactors } = assetData
  , annotationProps = { position: [20, 0, -10], guiData, setGuiData }
  
  return (<>
    {/* <DatGui data={guiData} onUpdate={setGuiData}>
      <DatBoolean path='showHelpers' label='Show Helpers' />
      <DatString path='activeObject' label='Active Object' />
    </DatGui> */}
    {guiData.showHelpers && <FPSStats bottom={50} left={30} top={"unset"}/>}
    <div id="overlay" className="flex-y align-items-center">
      <img className="loader" src="assets/images/loading.gif" />
      <div><h1>3D rendering of an Industrial Siteplan</h1></div>
      <div className="flex-x intro-parent">
        <div>
          <div className="flex-x item-image">
            <img className="icon" src="assets/images/browsers.png" /> <h2>Works best in Google Chrome / Microsoft Edge</h2>
          </div>
          <div className="flex-x item-image">
            <img className="icon" src="assets/images/wheel.png" /> <h2>Use mouse wheel to zoom in / out</h2>
          </div>
        </div>
        <div>
          <div className="flex-x item-image">
            <img className="icon" src="assets/images/drag.png" /> <h2>Click and drag mouse to rotate the scene</h2>
          </div>
          <div className="flex-x item-image">
            <img className="icon" src="assets/images/settings.png" /> <h2>Try out various configurations</h2>
          </div>
        </div>
      </div>
      <button id="enter" className="button smoke" onClick={() => {
        document.getElementById("overlay").classList.add("closed")
        }}>
        <div><span>E</span><span>n</span><span>t</span><span>e</span><span>r</span></div>
      </button>
    </div>
    <div id="ctn-about" className={`${viewData.toggleOpts ? "closed" : ""}`}>
      <h2>Industrial Siteplan</h2>
      <div>by&nbsp;
        <a href="http://envisagecyberart.in" target="_blank">Anurag Srivastava</a><br />
        <a href="http://envisagecyberart.in/projects/threejs-experiments" target="_blank">More 3D projects</a>
      </div>
      <a href="https://www.upwork.com/o/profiles/users/~01d929751d145a05ea/" target="_blank">
        <img src="assets/images/upwork.png" alt="" />
      </a>
      <a href="https://www.guru.com/freelancers/anurag-srivastava-27" target="_blank">
        <img src="assets/images/guru.png" alt="" />
      </a>
      <a href="mailto:anurag.131092@gmail.com&Subject=New Work Proposal">
        <img src="assets/images/gmail.png" alt="" />
      </a>
      <a href="https://stackoverflow.com/users/7867822/anurag-srivastava" target="_blank">
        <img src="assets/images/so.png" alt="" />
      </a>
      <a href="https://github.com/anuragsr" target="_blank">
        <img src="assets/images/github.png" alt="" />
      </a>
    </div>
    <Canvas className={`canvas${viewData.greyscale ? " gray" : ""}`}>
      <OrthographicCamera
        makeDefault
        position={[150, 70, 0]}
        zoom={14}
        near={0}
        far={5000}/>
      <ambientLight intensity={.1}/>
      <PointLightWithHelper 
        visible={guiData.showHelpers} 
        color={0xffffff} 
        intensity={1}
        position={[70, 50, 5]}
        />
      {guiData.showHelpers && <>
        <gridHelper args={[1000, 100]}/>
        <axesHelper args={[500]} /> 
      </>}
      <CameraControls />
      <Suspense fallback={<Box position={[0, 0, 0]} />}>
        <Buildings
          url="assets/models/buildings.glb"
          name="Buildings"
          position={[20, 0, -10]}
          opacity={viewData.opacity/100} 
          showLabels={viewData.visible === "buildings"}
          assets={buildings}
          guiData={guiData}
          setGuiData={setGuiData}/>
        <Ground name="Ground" position={[20, 0, -10]} url="assets/models/ground.glb" opacity={.8}/>
        <Annotation {...annotationProps} name="temp" showLabels={viewData.visible === "temp"} assets={temp} />
        <Annotation {...annotationProps} name="reactors" showLabels={viewData.visible === "react"} assets={reactors} />
      </Suspense>
    </Canvas>
    <button title="Toggle Controls"
      onClick={() => setViewData(prev => ({ ...prev, toggleOpts: !prev.toggleOpts }))} 
      className={`cursor-pointer btn-3d-toggle${viewData.toggleOpts ? " open" : ""}`}>
      <div></div>
    </button>
    <div className={`flex-y asset-list--wrapper${viewData.toggleOpts ? " closed" : ""}`}>
      <div className="flex-x space-between align-items-center">
        <div className="asset-list--item ctn-slider flex-x space-between align-items-center">
          <span>Building Transparency</span>
          <button
            className="btn cursor-pointer mr-3 flex-x center"
            onClick={() => handleChange(Math.max(0, viewData.opacity - 10), "opacity")}
          >-</button>
          <Slider
            trackStyle={{ backgroundColor: '#14ACEF', height: 5 }}
            handleStyle={{
              borderColor: '#14ACEF',
              backgroundColor: '#14ACEF',
              height: 14,
              width: 14,
              marginTop: -5,
            }}
            railStyle={{ backgroundColor: '#fff', height: 5 }}
            value={viewData.opacity}
            onChange={value => handleChange(value, "opacity")}
          />
          <button
            className="btn cursor-pointer ml-3 flex-x center"
            onClick={() => handleChange(Math.min(viewData.opacity + 10, 100), "opacity")}
          >+</button>
        </div>
        <div className="asset-list--item ctn-switch flex-y center">
          Greyscale <Switch value={viewData.greyscale} onChange={value => handleChange(value, "greyscale")}/>
        </div>
      </div>
      <div className="flex-y asset-list-container">{
        buildings.map((asset, i) => (
          <div key={i}
            className={`asset-list--item cursor-pointer${asset.mesh === guiData.activeObject ? " active" : ""}`}
            onMouseOver={() => setGuiData(prev => ({ ...prev, activeObject: asset.mesh }))}
            onMouseOut={() => setGuiData(prev => ({ ...prev, activeObject: "None" }))}>
            <div className="flex-x space-between align-items-center">
              <div className="ctn-name">
                <img src='assets/images/building.png' alt="" />{asset.name}
              </div>
              <img height="5" src='assets/images/arrow.png' alt="" />
            </div>
            <div className="content">{asset.desc}</div>
          </div>
        ))
      }</div>     
    </div>
    <div className={`flex-x center ctn-buttons-bottom${viewData.toggleOpts ? " closed" : ""}`}>
      <a href="#" className={`${viewData.visible === "buildings" ? "active" : ""}`} onClick={e => { showItems(e, "buildings") }}>Buildings</a>
      <a href="#" className={`${viewData.visible === "temp" ? "active" : ""}`} onClick={e => { showItems(e, "temp") }}>Temperature Sensors</a>
      <a href="#" className={`${viewData.visible === "react" ? "active" : ""}`} onClick={e => { showItems(e, "react") }}>Reactors</a>
      <a href="#" className={`${viewData.visible === "none" ? "active" : ""}`} onClick={e => { showItems(e, "none") }}>Clear</a>
    </div>
  </>)
}