import React from 'react';
import { BrowserRouter as Router, Prompt, Route, Link, NavLink, Switch, Redirect, withRouter } from 'react-router-dom';
import './style.css';

class Page1 extends React.PureComponent {
    state = { blocking: true }
    render() {
        console.log('the this of page1:', this, <p>corleone<span> hello</span></p>);
        return (<div>
            <Prompt when={this.state.blocking}
                message={location => `In Page1 你确定你要跳转到${location.pathname}吗`} />
            Page1!!
        </div>)
    }
}

class Page2 extends React.PureComponent {
    state = { blocking: true }
    componentDidMount() {
        this.unlisten = this.props.history.listen(w => {
            console.log('the w is:', w);
        })
    }
    render() {
        return (<div>
            <Prompt when={this.state.blocking}
                message={location => `In Page2 你确定你要跳转到${location.pathname}吗`} />
            Page2!!
            {/* <Router basename="/page2"> */}
            <Switch>
                <Route path="/page2/two" render={() => (<div>THE TWO</div>)}></Route>
                <Route path=":one" render={() => (<div>THE ONE</div>)}></Route>
            </Switch>
            {/* </Router> */}
        </div>)
    }
    componentWillUnmount() {
        this.unlisten();
    }
}
function Page3(props) {
    return (<div>
        <Prompt when={true}
            message={location => `In Page3你确定你要跳转到${location.pathname}吗`} />
        Page3!!
    </div>)
}

class Page4 extends React.Component {
    componentDidMount() {
        this.unblock = this.props.history.block('Are you sure you want to leave this page?');
    }
    componentWillUnmount() {
        this.unblock();
    }
    render() {
        return <> Just the page4!!!</>
    }
}
export class Page5 extends React.Component {
    componentDidMount() {
        this.unblock = this.props.history.block((location, action) => {
            if (location.pathname !== '') return 'Are you sure you want to leave this page?';
        });
    }
    componentWillUnmount() {
        this.unblock();
    }
    render() {
        return <> Page5</>
    }
}
const WithRouterC = withRouter(Page4);

export default function () {
    return (
        <>
            列表
            <Router basename='/corleone' >
                {/* <Link to='/1'><div>1</div></Link> */}
                <NavLink to='/page1' activeClassName='one' innerRef={ref => { console.log('the navlink ref:', ref); }} exact strict><div>page1</div></NavLink>
                <Link to='/page2'><div>page2</div></Link>
                <Link to='/with_router/extra'><div>with_router</div></Link>
                <Link to='/redirect'><div>redirect</div></Link>
                <Link to='/link'><div>link</div></Link>
                <br /><br />


                <Route path='/by_children' location={{ pathname: "/by_children", search: "", hash: "", state: undefined, key: "some key" }}><li className="props">
                    <Link to='/with_router'>$$with router by rendered children</Link>
                </li></Route>
                <Switch>
                    <Route path="/page1/:id?" component={(props) => <Page1 {...props}/>} />
                    <Route path="/page2" component={Page2} context={{ name: 'corleone' }} />
                    {/* <Route render={Page3} /> */}
                    <Route path='/page3' render={Page3} />
                    <Route path='/with_router' component={WithRouterC} />
                    <Redirect from='/redirect' to='/page3' />
                    {/* <Route path='/link' children={props => {
                        return (
                            <li className={props.match ? "active" : ""}>
                                <Link to='/with_router'>with router children</Link>
                            </li>
                        )
                    }} /> */}

                </Switch>

                {/* <WithRouterC hehe='fjkd' wrappedComponentRef={ref => { console.log('>>>>>the ref:', ref) }} /> */}
            </Router>

            <br />
        </>
    )
}
