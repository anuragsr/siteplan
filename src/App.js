import React, { useRef, useState, Suspense } from 'react'
import { extend, Canvas, useFrame, useThree, useLoader } from 'react-three-fiber'
import { Html, OrthographicCamera } from '@react-three/drei'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import * as THREE from 'three'

// Debug
import DatGui, { DatBoolean, DatString } from 'react-dat-gui'
import 'react-dat-gui/dist/index.css'
import FPSStats from 'react-fps-stats'
import { l } from './helpers/index'

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
    controls.current.minZoom = 5.5;
    controls.current.maxZoom = 10;

    // For perspective camera
    // controls.current.minDistance = 150;
    // controls.current.maxDistance = 250;

    controls.current.enableDamping = true;
    controls.current.dampingFactor = 0.05;
    // controls.current.enablePan = false;
    controls.current.autoRotate = true;
    controls.current.autoRotateSpeed = .2;
    controls.current.enableKeys = false;
  }

  inspect()

  // Ref to the controls, so that we can update them on every frame using useFrame
  const controls = useRef()
  useFrame(() => {
    controls.current.update()
    // scene.rotation.y+=0.00025
  })

  // controls.current && setControlParams()

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
, PointLightWithHelper = ({ color, pos, visible }) => {
  return (
    <pointLight position={pos} color={color}>
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
            onPointerOver={(event) => {
              // l("over group", event.object.name, event.object.parent.name)
              event.stopPropagation()
              setGuiData(prev => ({ ...prev, activeObject: event.object.parent.name }))
            }}>
            <meshStandardMaterial {...child.material} transparent opacity={opacity}
              emissive={guiData.activeObject === name ? 0xff0000 : child.material.origEmissive} />
          </mesh>)
      })
    }</group>
  )
}
, BuildingMesh = props => {
  const { name, guiData, setGuiData, opacity, material } = props
  return (
    <mesh {...props}
      onPointerOver={(event) => {
        // l("over mesh", event.object.name, event.object.name)
        event.stopPropagation()
        setGuiData(prev => ({ ...prev, activeObject: event.object.name }))
      }}>
      <meshStandardMaterial {...material} transparent opacity={opacity}
        emissive={guiData.activeObject === name ? 0xff0000 : material.origEmissive} />
    </mesh>
  )
}
, Buildings = ({ name, url, pos, opacity, showLabels, guiData, setGuiData }) => {
  // l("Building Labels", showLabels)
  const gltf = useLoader(GLTFLoader, url)
  // l(gltf.scene)
  // document.getElementById("overlay").classList.add("closed")

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
    <group name={name}>{
      gltf.scene.children.map((child, idx) => {
        const childProps = { ...child, opacity, guiData, setGuiData }
        return (
          <React.Fragment key={idx}>
            {child.type === 'Group' && <BuildingMeshGroup {...childProps} />}
            {child.type === 'Mesh' && <BuildingMesh {...childProps} />}
            {showLabels && <Html center position={child.position}>
              <div className="css3D" id={`ann${idx}`}>
                <div className="pos-relative">
                  <div className="name">{child.name}</div>
                  <div className="ctn-point pos-relative">
                    <img src={point3D} alt=""/>
                    <img src={point3DHover} alt=""/>
                  </div>
                  <div className="line"></div>
                </div>
              </div>
            </Html>}
          </React.Fragment>
        )
      })
    }</group>
  )
}
, Ground = ({ name, url, setGuiData }) => {
  const gltf = useLoader(GLTFLoader, url )
  // l(gltf.scene)
  // document.getElementById("overlay").classList.add("closed")

  return <primitive name={name}
    object={gltf.scene}
    onPointerOver={() => {
      // l("over ground", event.object.name, event.object.parent.name)
      setGuiData(prev => ({ ...prev, activeObject: "None" }))
    }}/>
}
, App = () => {
  const [guiData, setGuiData] = useState({ 
    activeObject: "None",
    showHelpers: true
  })
  , [sidebarData, setSidebarData] = useState({
    opacity: 100, greyscale: false, visible: "none"
  })
  , handleChange = (value, property) => {
    setSidebarData(prev => ({ ...prev, [property]: value }))
  }
  , showItems = (e, type) => {
    e.preventDefault()
    setSidebarData(prev => ({ ...prev, visible: type }))
  }

  return (
    <>
      {guiData.showHelpers && <FPSStats left={10} top={10}/>}
      <DatGui data={guiData} onUpdate={setGuiData}>
        <DatBoolean path='showHelpers' label='Show Helpers' />
        <DatString path='activeObject' label='Active Object' />
      </DatGui>
      <Canvas>
        <OrthographicCamera
          makeDefault
          position={[250, 250, 250]}
          zoom={10}
          near={0}
          far={5000}/>
        <ambientLight intensity={.1}/>
        <PointLightWithHelper visible={guiData.showHelpers} color={0xffffff} pos={[150, 75, 150]}/>
        <gridHelper args={[1000, 100]} visible={guiData.showHelpers} />
        <axesHelper args={[500]} visible={guiData.showHelpers} />
        <pointLight position={[10, 10, 10]} />
        <CameraControls />
        <Suspense fallback={<Box position={[0, 0, 0]} />}>
          <Buildings
            name="Buildings"
            url="/models/buildings-v2.glb"
            showLabels={sidebarData.visible === "buildings"}
            opacity={sidebarData.opacity/100} 
            guiData={guiData}
            setGuiData={setGuiData}/>
          <Ground
            name="Ground"
            url="/models/ground-v2.glb" 
            setGuiData={setGuiData}
            />
          {/*{
            siteAssets && <SiteAssets
                // pos={[-50, 0, 0]}
                showLabels={sidebarData.visible === "assets"}
                name="Site Assets"
                siteAssets={siteAssets}/>
          }
          {
            siteTempSensors && <SiteTempSensors
                // pos={[-50, 0, 0]}
                name="Site Temp Sensors"
                showLabels={sidebarData.visible === "temp"}
                siteTempSensors={siteTempSensors}/>
          }
          {
            siteTempSensors && <SiteReactors
                // pos={[-50, 0, 0]}
                name="Site Reactors"
                showLabels={sidebarData.visible === "react"}
                siteReactors={siteTempSensors}/>
          }*/}
        </Suspense>
      </Canvas>
    </>
  )
}

export default App
