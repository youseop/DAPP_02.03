import React, { Component } from 'react';
import Web3 from 'web3';
import Identicon from 'identicon.js';
import './App.css';
import Decentragram from '../abis/Decentragram.json'
import Navbar from './Navbar'
import Main from './Main'

const ipfsClient = require('ipfs-http-client');
const ipfs = ipfsClient({host: 'ipfs.infura.io', port:5001, protocol: 'https'});


class App extends Component {

  async componentWillMount() {
    await this.loadWeb3();
    await this.loadBlockchainData();
  }

  async loadWeb3() {
    if(window.ethereum) {
      window.web3 = new Web3(window.ethereum)
      await window.ethereum.enable();
    } else if(window.web3){
      window.web3 = new Web3(window.web3.currentProvider);
    } else {
      window.alert("non-ethereum browser detected. you should consider trying metamask!");
    }
  }

  async loadBlockchainData() {
    const {web3} = window;
    const accounts = await web3.eth.getAccounts();
    this.setState({account: accounts[0]});

    const networkId = await web3.eth.net.getId();
    const networkData = Decentragram.networks[networkId];
    if(networkData){
      const decentragram = web3.eth.Contract(
        Decentragram.abi, 
        networkData.address
      );
      const imagesCount = await decentragram.methods.imageCount().call();
      
      this.setState({loading:false,decentragram, imagesCount:imagesCount.toNumber()});

      const imageArray = [];

      for (let i=1; i<=imagesCount.toNumber(); i++){
        const image = await decentragram.methods.images(i).call();
        imageArray.push(image);
        // console.log(image)
      }
      // console.log('imageArray:',imageArray);

      this.setState({
        images: [...this.state.images, ...imageArray].sort((a,b)=> b.tipAmount - a.tipAmount)
      })
    } else {
      alert("Contract isn't deployed to detected network.");
    }
  }

  captureFile = event => {
    event.preventDefault();
    const file = event.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(file);

    reader.onloadend = () => {
      this.setState({buffer: Buffer(reader.result)});
      console.log("buffer", this.state.buffer)
    }
  }

  uploadImage = description => {
    console.log("submitting file to ipfs...");

    ipfs.add(this.state.buffer, (error, result) => {
      if(error){
        console.error(error);
        return;
      } 

      this.setState({loading:true});

      this.state.decentragram.methods.uploadImage(
        result[0].hash, 
        description
      ).send(
        {from: this.state.account}
      ).on('transactionHash', (hash) => {
        this.setState({loading:false});
      }).catch(err => {
        console.log(err)
        if(err.code === 4001){
          this.setState({loading:false});
        }
        alert(err.message)
      });
    })
  }

  tipImageOwner = (id, tipAmount) => {
    this.setState({loading: true});
    this.state.decentragram.methods.tipImageOwner(id)
    .send({
      from: this.state.account, value: tipAmount 
    })
    .on('transactionHash', (hash) => {
      this.setState({loading: false});
    })

  }

  constructor(props) {
    super(props)
    this.state = {
      account: '',
      decentragram:null,
      images: [],
      loading: true,
      imagesCount: 0
    }
  }

  render() {
    return (
      <div>
        <Navbar account={this.state.account} />
        { this.state.loading
          ? <div id="loader" className="text-center mt-5"><p>Loading...</p></div>
          : <Main
              images={this.state.images}
              captureFile={this.captureFile}
              uploadImage={this.uploadImage}
              tipImageOwner={this.tipImageOwner}
            />
          }
        }
      </div>
    );
  }
}

export default App;